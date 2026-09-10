import { strFromU8, unzipSync } from 'fflate';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	renameSync,
	rmdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { PublicPreflight, PublicSkillDetail, SkillEntry, Target } from 'skill-schema';
import { loadPackageFromFiles, type PackageFile } from 'validator';
import { fetchPreflight, resolveApiUrl } from './api';
import {
	confirmRisk,
	createOutput,
	GLOBAL_NEEDS_TARGET,
	isOccupied,
	planMembers,
	receiptFor,
	TARGET_OR_DIR,
	type Push,
} from './install';
import { resolvePackMembers } from './pack';
import { recordReceipt } from './receipts';
import { renderPreflightReport } from './render';
import type { CommandResult } from './scan';
import type { Styler } from './style';
import {
	knownAreas,
	MAPPED_TARGETS,
	mappableDeclaredTargets,
	resolveTargetArea,
	resolveTargetDir,
} from './targets';

export interface AddOptions {
	yes?: boolean;
	dir?: string;
	target?: string;
	global?: boolean;
	cwd?: string;
	apiUrl?: string;
	fetchImpl?: typeof fetch;
	confirmImpl?: (question: string) => Promise<boolean>;
	promptImpl?: (question: string) => Promise<string>;
	style?: Styler;
	// Streams lines as they happen so interactive prompts appear AFTER the
	// pre-flight report, not before it. Lines are still returned for tests.
	emit?: (text: string) => void;
}

function unsafeEntryPath(path: string): boolean {
	return isAbsolute(path) || path.split('/').includes('..') || path.includes('\\');
}

// Mirror the server snapshot caps (apps/api/src/github/snapshot.ts) so the CLI
// never trusts an oversized response, even from an overridden SKILLPASS_API.
const MAX_FILES = 500;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_ZIP_BYTES = 20 * 1024 * 1024;

class OversizedDownloadError extends Error {}

export type Download = { ok: true; files: PackageFile[] } | { ok: false; message: string };

// Download the version snapshot and prove it is byte-identical to what the
// validator saw; no caller writes anything on a not-ok result.
export async function downloadVerified(
	fetchImpl: typeof fetch,
	apiUrl: string,
	slug: string,
	version: string,
	sourceHash: string,
): Promise<Download> {
	const downloadUrl = `${apiUrl}/skills/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/download?source=cli`;
	let res: Response;
	try {
		res = await fetchImpl(downloadUrl);
	} catch {
		return { ok: false, message: `cannot reach the API at ${downloadUrl}` };
	}
	if (!res.ok) {
		return { ok: false, message: `download failed (${res.status})` };
	}
	const body = new Uint8Array(await res.arrayBuffer());
	if (body.byteLength > MAX_ZIP_BYTES) {
		return { ok: false, message: 'the download is larger than the expected maximum; nothing was installed' };
	}
	let entries: Record<string, Uint8Array>;
	try {
		let fileCount = 0;
		let totalBytes = 0;
		entries = unzipSync(body, {
			filter: (info) => {
				fileCount += 1;
				totalBytes += info.originalSize;
				if (
					fileCount > MAX_FILES ||
					info.originalSize > MAX_FILE_BYTES ||
					totalBytes > MAX_TOTAL_BYTES
				) {
					throw new OversizedDownloadError();
				}
				return true;
			},
		});
	} catch (err) {
		if (err instanceof OversizedDownloadError) {
			return { ok: false, message: 'the download exceeds the size caps; nothing was installed' };
		}
		return { ok: false, message: 'the download was not a valid zip' };
	}
	const files: PackageFile[] = Object.entries(entries).map(([path, data]) => ({
		path,
		content: strFromU8(data),
	}));
	const unsafe = files.find((f) => unsafeEntryPath(f.path));
	if (unsafe) {
		return { ok: false, message: `refusing unsafe entry path "${unsafe.path}" in the download` };
	}
	if (loadPackageFromFiles(files).sourceHash !== sourceHash) {
		return {
			ok: false,
			message: 'the downloaded files do not match the pinned source hash; nothing was installed',
		};
	}
	return { ok: true, files };
}

// Write to a sibling temp dir and rename into place, so a failed write never
// leaves a partial tree behind.
export function writeTree(files: PackageFile[], target: string): void {
	const tempDir = `${target}.tmp-${process.pid}`;
	try {
		for (const file of files) {
			const filePath = join(tempDir, file.path);
			mkdirSync(dirname(filePath), { recursive: true });
			writeFileSync(filePath, file.content);
		}
		mkdirSync(dirname(target), { recursive: true });
		if (existsSync(target)) {
			rmdirSync(target);
		}
		renameSync(tempDir, target);
	} catch (err) {
		rmSync(tempDir, { recursive: true, force: true });
		throw err;
	}
}

interface InstallChoice {
	label: string;
	dir: string;
}

// Declared tools first, then the other mapped tools marked as undeclared -
// hiding a real install location is worse than labeling it honestly.
export function installChoices(declared: Target[], slug: string): InstallChoice[] {
	const choices: InstallChoice[] = [];
	const ordered = [
		...MAPPED_TARGETS.filter((t) => declared.includes(t)),
		...MAPPED_TARGETS.filter((t) => !declared.includes(t)),
	];
	for (const tool of ordered) {
		const note = declared.includes(tool) ? '' : ' - not declared by this skill';
		const resolved = resolveTargetDir(tool, slug);
		if (resolved.ok) {
			choices.push({ label: `${tool} skills folder (${resolved.dir})${note}`, dir: resolved.dir });
		}
		const global = resolveTargetDir(tool, slug, true);
		if (global.ok) {
			choices.push({
				label: `${tool} user-level skills folder (${global.dir})${note}`,
				dir: global.dir,
			});
		}
	}
	choices.push({ label: `current directory (./${slug})`, dir: slug });
	return choices;
}

interface PackChoice {
	label: string;
	// Absent tool means the raw-snapshot fallback into ./<slug>.
	tool?: string;
	global?: boolean;
}

function packChoices(declared: Target[], slug: string, count: number): PackChoice[] {
	const choices: PackChoice[] = [];
	const ordered = [
		...MAPPED_TARGETS.filter((t) => declared.includes(t)),
		...MAPPED_TARGETS.filter((t) => !declared.includes(t)),
	];
	for (const tool of ordered) {
		const note = declared.includes(tool) ? '' : ' - not declared by this pack';
		const project = resolveTargetArea(tool);
		if (project.ok) {
			choices.push({
				label: `${tool} skills folder (${project.dir}) - ${count} skills${note}`,
				tool,
				global: false,
			});
		}
		const global = resolveTargetArea(tool, true);
		if (global.ok) {
			choices.push({
				label: `${tool} user-level skills folder (${global.dir}) - ${count} skills${note}`,
				tool,
				global: true,
			});
		}
	}
	choices.push({ label: `current directory (./${slug}, raw pack source)` });
	return choices;
}

// Everything a single install strategy needs once the pre-flight has passed.
interface AddContext {
	push: Push;
	done: (exitCode: number) => CommandResult;
	fetchImpl: typeof fetch;
	apiUrl: string;
	cwd: string;
	slug: string;
	preflight: PublicPreflight;
}

type Prompt = (question: string) => Promise<string>;

async function promptIndex(ask: Prompt, count: number, push: Push): Promise<number> {
	while (true) {
		const answer = (await ask(`Where should it go? [1-${count}, default 1] `)).trim();
		if (answer === '') return 0;
		const index = /^\d+$/.test(answer) ? Number.parseInt(answer, 10) - 1 : -1;
		if (index >= 0 && index < count) return index;
		push(`  answer 1-${count}, or press enter for the default`);
	}
}

type PackLocation = { tool: string; global: boolean } | { dir: string };

// No --target or --dir on a pack: ask when there is a prompt, otherwise drop
// the raw source in ./<slug> and tip the fan-out install.
async function choosePackLocation(
	ctx: AddContext,
	detail: PublicSkillDetail,
	memberCount: number,
	prompt: Prompt | undefined,
): Promise<PackLocation> {
	if (prompt) {
		const choices = packChoices(detail.targets, ctx.slug, memberCount);
		ctx.push('', 'Install location:');
		choices.forEach((choice, i) => ctx.push(`  ${i + 1}) ${choice.label}`));
		const chosen = choices[await promptIndex(prompt, choices.length, ctx.push)];
		return chosen.tool ? { tool: chosen.tool, global: chosen.global ?? false } : { dir: ctx.slug };
	}
	const mappable = mappableDeclaredTargets(detail.targets);
	if (mappable.length > 0) {
		ctx.push(
			'',
			`tip: --target ${mappable[0]} installs the ${memberCount} skills into the tool's skills folder`,
		);
	}
	return { dir: ctx.slug };
}

async function chooseSingleLocation(
	ctx: AddContext,
	detail: PublicSkillDetail,
	prompt: Prompt | undefined,
): Promise<string> {
	const choices = installChoices(detail.targets, ctx.slug);
	if (prompt && choices.length > 1) {
		ctx.push('', 'Install location:');
		choices.forEach((choice, i) => ctx.push(`  ${i + 1}) ${choice.label}`));
		return choices[await promptIndex(prompt, choices.length, ctx.push)].dir;
	}
	const mappable = mappableDeclaredTargets(detail.targets);
	if (mappable.length > 0) {
		ctx.push('', `tip: --target ${mappable[0]} installs into the tool's skills folder`);
	}
	return ctx.slug;
}

// Fan a pack out into a tool's skills area, one folder per supported member.
async function installPack(
	ctx: AddContext,
	members: SkillEntry[],
	tool: string,
	global: boolean,
): Promise<CommandResult> {
	const { push, done, slug, preflight } = ctx;
	const area = resolveTargetArea(tool, global);
	if (!area.ok) {
		push('', `error: ${area.message}`);
		return done(2);
	}
	const { installs, skipped } = resolvePackMembers(members, tool);
	if (installs.length === 0) {
		push('', `error: none of this pack's skills support ${tool}`);
		return done(2);
	}
	const areaAbs = resolve(ctx.cwd, area.dir);
	const conflicts = installs.map((m) => join(areaAbs, m.name)).filter(isOccupied);
	if (conflicts.length > 0) {
		push(
			'',
			'error: these destinations already exist and are not empty; nothing was installed:',
			...conflicts.map((c) => `  ${c}`),
		);
		return done(2);
	}
	const download = await downloadVerified(ctx.fetchImpl, ctx.apiUrl, slug, preflight.version, preflight.sourceHash);
	if (!download.ok) {
		push('', `error: ${download.message}`);
		return done(2);
	}
	const plans = planMembers(installs, download.files);
	const missing = plans.find((p) => p.files.length === 0);
	if (missing) {
		push('', `error: the snapshot has no files for "${missing.name}"; nothing was installed`);
		return done(2);
	}
	for (const name of skipped) {
		push('', `note: ${name} does not support ${tool}; skipped`);
	}
	const written: string[] = [];
	try {
		for (const plan of plans) {
			writeTree(plan.files, join(areaAbs, plan.name));
			written.push(plan.name);
			// Receipt per member as it lands, so a later failure leaves nothing unaccounted for.
			recordReceipt(areaAbs, plan.name, receiptFor(preflight, slug));
		}
	} catch {
		push(
			'',
			`error: could not write ${plans[written.length].name}; installed before the failure: ${written.join(', ') || 'none'}`,
		);
		return done(2);
	}
	push(
		'',
		`Installed ${written.length} skills to ${areaAbs}`,
		`  ${written.join(', ')}`,
		'Source hash verified against the Skill Passport.',
	);
	return done(0);
}

// Install one skill (or a pack's raw source) into a single folder.
async function installSingle(ctx: AddContext, targetDir: string): Promise<CommandResult> {
	const { push, done, slug, preflight } = ctx;
	const target = resolve(ctx.cwd, targetDir);
	if (existsSync(target)) {
		if (!statSync(target).isDirectory()) {
			push('', `error: target ${target} already exists and is not a directory`);
			return done(2);
		}
		if (readdirSync(target).length > 0) {
			push('', `error: target directory ${target} already exists and is not empty`);
			return done(2);
		}
	}
	const download = await downloadVerified(ctx.fetchImpl, ctx.apiUrl, slug, preflight.version, preflight.sourceHash);
	if (!download.ok) {
		push('', `error: ${download.message}`);
		return done(2);
	}
	try {
		writeTree(download.files, target);
	} catch {
		push('', 'error: could not write the install; nothing was installed');
		return done(2);
	}
	const area = knownAreas(ctx.cwd).find((a) => a.dir === dirname(target));
	if (area) {
		recordReceipt(area.dir, slug, receiptFor(preflight));
	}
	push(
		'',
		`Installed ${download.files.length} file(s) to ${target}`,
		'Source hash verified against the Skill Passport.',
	);
	return done(0);
}

// Exit codes are contract: 0 installed, 1 blocked, 2 refused (confirmation,
// verification, target, network). Nothing touches disk until the downloaded
// bytes re-verify against the pinned source hash.
export async function runAdd(ref: string, opts: AddOptions = {}): Promise<CommandResult> {
	const { push, done } = createOutput(opts.emit);

	if (opts.target && opts.dir) {
		push(TARGET_OR_DIR);
		return done(2);
	}
	if (opts.global && !opts.target) {
		push(GLOBAL_NEEDS_TARGET);
		return done(2);
	}
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	const apiUrl = resolveApiUrl(opts.apiUrl);
	const fetched = await fetchPreflight(fetchImpl, apiUrl, ref);
	if (!fetched.ok) {
		push(...fetched.result.lines);
		return done(fetched.result.exitCode);
	}
	const { slug, detail, preflight } = fetched;
	push(...renderPreflightReport(detail, preflight, opts.style));

	if (preflight.blocked) {
		return done(1);
	}

	const members = detail.packMembers ?? [];
	const isPack = members.length > 0;

	let targetDir = opts.dir;
	let pack: { tool: string; global: boolean } | undefined;

	if (opts.target) {
		const resolved = isPack
			? resolveTargetArea(opts.target, opts.global)
			: resolveTargetDir(opts.target, slug, opts.global);
		if (!resolved.ok) {
			push('', `error: ${resolved.message}`);
			return done(2);
		}
		if (isPack) {
			pack = { tool: opts.target, global: opts.global ?? false };
		} else {
			targetDir = resolved.dir;
		}
		if (!(detail.targets as string[]).includes(opts.target)) {
			push('', `warning: this skill does not declare ${opts.target} as a target`);
		}
	}

	const confirmed = await confirmRisk(
		preflight,
		opts,
		`Install ${slug}@${preflight.version} (${preflight.riskLevel} risk)? [y/N] `,
		'Install aborted.',
		push,
	);
	if (!confirmed) return done(2);

	const ctx: AddContext = {
		push,
		done,
		fetchImpl,
		apiUrl,
		cwd: opts.cwd ?? process.cwd(),
		slug,
		preflight,
	};

	if (isPack && pack === undefined && targetDir === undefined) {
		const location = await choosePackLocation(ctx, detail, members.length, opts.promptImpl);
		if ('tool' in location) pack = location;
		else targetDir = location.dir;
	}
	if (pack !== undefined) {
		return installPack(ctx, members, pack.tool, pack.global);
	}

	if (isPack && opts.dir) {
		push(
			'',
			`note: --dir installs the raw pack source; --target <tool> installs the ${members.length} skills individually`,
		);
	}
	return installSingle(ctx, targetDir ?? (await chooseSingleLocation(ctx, detail, opts.promptImpl)));
}
