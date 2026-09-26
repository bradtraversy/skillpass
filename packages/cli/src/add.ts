import { strFromU8, unzipSync } from 'fflate';
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { slugForSkill, type RiskLevel, type SkillEntry, type Target } from 'skill-schema';
import { loadPackageFromFiles, validateLoadedPackage, type PackageFile } from 'validator';
import { fetchPreflight, resolveApiUrl } from './api';
import { fetchRepoFiles, resolveCommit } from './github';
import {
	cappedFilter,
	confirmRisk,
	createOutput,
	GLOBAL_NEEDS_TARGET,
	isOccupied,
	MAX_ZIP_BYTES,
	OversizedArchiveError,
	planMembers,
	receiptFor,
	TARGET_OR_DIR,
	unsafeEntryPath,
	type Push,
} from './install';
import { resolvePackMembers } from './pack';
import { originLabel, recordReceipt, type Receipt, type UnlistedOrigin } from './receipts';
import { renderLocalPreflight, renderPreflightReport } from './render';
import { isRepoRef, packageNameFor, parseRepoRef } from './repo';
import type { CommandResult } from './scan';
import type { Styler } from './style';
import { declaresTool, knownAreas, mappableDeclaredTargets, resolveArea, type KnownArea } from './targets';

export interface AddOptions {
	yes?: boolean;
	dir?: string;
	// One tool, or several to install into each tool's folder in one pass.
	target?: string | string[];
	global?: boolean;
	cwd?: string;
	home?: string;
	apiUrl?: string;
	fetchImpl?: typeof fetch;
	confirmImpl?: (question: string) => Promise<boolean>;
	promptImpl?: (question: string) => Promise<string>;
	style?: Styler;
	// Streams lines as they happen so interactive prompts appear AFTER the
	// pre-flight report, not before it. Lines are still returned for tests.
	emit?: (text: string) => void;
}

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
		entries = unzipSync(body, { filter: cappedFilter() });
	} catch (err) {
		if (err instanceof OversizedArchiveError) {
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

// Areas a declared tool reads first, then the rest marked as undeclared -
// hiding a real install location is worse than labeling it honestly.
function orderedAreas(declared: readonly string[], cwd: string, home?: string): (KnownArea & { declared: boolean })[] {
	const areas = knownAreas(cwd, home).map((area) => ({
		...area,
		declared: area.tools.some((tool) => declaresTool(declared, tool)),
	}));
	return [...areas.filter((a) => a.declared), ...areas.filter((a) => !a.declared)];
}

export function installChoices(declared: Target[], slug: string, cwd: string, home?: string): InstallChoice[] {
	const choices: InstallChoice[] = orderedAreas(declared, cwd, home).map((area) => ({
		label: `${area.label}${area.declared ? '' : ' - not declared by this skill'}`,
		dir: join(area.dir, slug),
	}));
	choices.push({ label: `current directory (./${slug})`, dir: slug });
	return choices;
}

interface PackChoice {
	label: string;
	// Absent area means the raw-snapshot fallback into ./<slug>.
	area?: KnownArea;
}

function packChoices(declared: Target[], slug: string, count: number, cwd: string, home?: string): PackChoice[] {
	const choices: PackChoice[] = orderedAreas(declared, cwd, home).map((area) => ({
		label: `${area.label} - ${count} skills${area.declared ? '' : ' - not declared by this pack'}`,
		area,
	}));
	choices.push({ label: `current directory (./${slug}, raw pack source)` });
	return choices;
}

// Everything an install strategy needs once the pre-flight has passed, from
// either source: the directory (verified download) or a repo (local validation).
interface AddContext {
	push: Push;
	done: (exitCode: number) => CommandResult;
	cwd: string;
	home?: string;
	slug: string;
	targets: Target[];
	files: () => Promise<Download>;
	receipt: (packSlug?: string) => Receipt;
	// Closing line after a successful install.
	verifiedLine: string;
}

// A known area plus the tool name the user asked for, for messages.
interface AreaTarget {
	area: KnownArea;
	tool: string;
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

type PackLocation = { area: KnownArea } | { dir: string };

// No --target or --dir on a pack: ask when there is a prompt, otherwise drop
// the raw source in ./<slug> and tip the fan-out install.
async function choosePackLocation(
	ctx: AddContext,
	memberCount: number,
	prompt: Prompt | undefined,
): Promise<PackLocation> {
	if (prompt) {
		const choices = packChoices(ctx.targets, ctx.slug, memberCount, ctx.cwd, ctx.home);
		ctx.push('', 'Install location:');
		choices.forEach((choice, i) => ctx.push(`  ${i + 1}) ${choice.label}`));
		const chosen = choices[await promptIndex(prompt, choices.length, ctx.push)];
		return chosen.area ? { area: chosen.area } : { dir: ctx.slug };
	}
	const mappable = mappableDeclaredTargets(ctx.targets);
	if (mappable.length > 0) {
		ctx.push('', `tip: --target ${mappable[0]} installs the ${memberCount} skills into the tool's skills folder`);
	}
	return { dir: ctx.slug };
}

async function chooseSingleLocation(ctx: AddContext, prompt: Prompt | undefined): Promise<string> {
	const choices = installChoices(ctx.targets, ctx.slug, ctx.cwd, ctx.home);
	if (prompt && choices.length > 1) {
		ctx.push('', 'Install location:');
		choices.forEach((choice, i) => ctx.push(`  ${i + 1}) ${choice.label}`));
		return choices[await promptIndex(prompt, choices.length, ctx.push)].dir;
	}
	const mappable = mappableDeclaredTargets(ctx.targets);
	if (mappable.length > 0) {
		ctx.push('', `tip: --target ${mappable[0]} installs into the tool's skills folder`);
	}
	return ctx.slug;
}

// Fan a pack out into each area, one folder per member the area's layout
// supports. Every destination is checked before the single download.
async function installPack(ctx: AddContext, members: SkillEntry[], targets: AreaTarget[]): Promise<CommandResult> {
	const { push, done, slug } = ctx;
	const resolved = targets.map(({ area, tool }) => ({ area, tool, ...resolvePackMembers(members, area.layout) }));
	const unsupported = resolved.find((r) => r.installs.length === 0);
	if (unsupported) {
		push('', `error: none of this pack's skills support ${unsupported.tool}`);
		return done(2);
	}
	const conflicts = resolved.flatMap((r) => r.installs.map((m) => join(r.area.dir, m.name))).filter(isOccupied);
	if (conflicts.length > 0) {
		push(
			'',
			'error: these destinations already exist and are not empty; nothing was installed:',
			...conflicts.map((c) => `  ${c}`),
		);
		return done(2);
	}
	const download = await ctx.files();
	if (!download.ok) {
		push('', `error: ${download.message}`);
		return done(2);
	}
	const planned = resolved.map((r) => ({ ...r, plans: planMembers(r.installs, download.files) }));
	const missing = planned.flatMap((r) => r.plans).find((p) => p.files.length === 0);
	if (missing) {
		push('', `error: the snapshot has no files for "${missing.name}"; nothing was installed`);
		return done(2);
	}
	for (const r of planned) {
		for (const name of r.skipped) {
			push('', `note: ${name} does not support ${r.tool}; skipped`);
		}
	}
	// What landed, per area when there is more than one, so a failure reports it all.
	const landed: string[] = [];
	const describe = (dir: string, names: string[]) =>
		planned.length > 1 ? `${dir}: ${names.join(', ')}` : names.join(', ');
	for (const r of planned) {
		const written: string[] = [];
		try {
			for (const plan of r.plans) {
				writeTree(plan.files, join(r.area.dir, plan.name));
				written.push(plan.name);
				// Receipt per member as it lands, so a later failure leaves nothing unaccounted for.
				recordReceipt(r.area.dir, plan.name, ctx.receipt(slug));
			}
		} catch {
			const before = [...landed, ...(written.length > 0 ? [describe(r.area.dir, written)] : [])];
			const where = planned.length > 1 ? ` in ${r.area.dir}` : '';
			push(
				'',
				`error: could not write ${r.plans[written.length].name}${where}; installed before the failure: ${before.join('; ') || 'none'}`,
			);
			return done(2);
		}
		landed.push(describe(r.area.dir, written));
		push('', `Installed ${written.length} skills to ${r.area.dir}`, `  ${written.join(', ')}`);
	}
	push(ctx.verifiedLine);
	return done(0);
}

// Install one skill (or a pack's raw source) into each folder. Every
// destination is checked before the single download.
async function installSingle(ctx: AddContext, targetDirs: string[]): Promise<CommandResult> {
	const { push, done, slug } = ctx;
	const targets = targetDirs.map((dir) => resolve(ctx.cwd, dir));
	for (const target of targets) {
		if (!existsSync(target)) continue;
		if (!statSync(target).isDirectory()) {
			push('', `error: target ${target} already exists and is not a directory`);
			return done(2);
		}
		if (readdirSync(target).length > 0) {
			push('', `error: target directory ${target} already exists and is not empty`);
			return done(2);
		}
	}
	const download = await ctx.files();
	if (!download.ok) {
		push('', `error: ${download.message}`);
		return done(2);
	}
	const areas = knownAreas(ctx.cwd, ctx.home);
	const landed: string[] = [];
	for (const target of targets) {
		try {
			writeTree(download.files, target);
		} catch {
			push(
				'',
				landed.length === 0
					? 'error: could not write the install; nothing was installed'
					: `error: could not write ${target}; installed before the failure: ${landed.join(', ')}`,
			);
			return done(2);
		}
		landed.push(target);
		const area = areas.find((a) => a.dir === dirname(target));
		if (area) {
			recordReceipt(area.dir, slug, ctx.receipt());
		}
		push('', `Installed ${download.files.length} file(s) to ${target}`);
	}
	push(ctx.verifiedLine);
	return done(0);
}

// What a source hands to the install strategies once its report is on screen.
interface Source extends Pick<AddContext, 'slug' | 'targets' | 'files' | 'receipt' | 'verifiedLine'> {
	members: SkillEntry[];
	riskLevel: RiskLevel;
	blocked: boolean;
	// Names the install in the confirmation question.
	label: string;
}

type SourceResult = { ok: true; source: Source } | { ok: false; exitCode: number };

async function directorySource(
	ref: string,
	opts: AddOptions,
	fetchImpl: typeof fetch,
	push: Push,
): Promise<SourceResult> {
	const apiUrl = resolveApiUrl(opts.apiUrl);
	const fetched = await fetchPreflight(fetchImpl, apiUrl, ref);
	if (!fetched.ok) {
		push(...fetched.result.lines);
		return { ok: false, exitCode: fetched.result.exitCode };
	}
	const { slug, detail, preflight } = fetched;
	push(...renderPreflightReport(detail, preflight, opts.style));
	return {
		ok: true,
		source: {
			slug,
			targets: detail.targets,
			members: detail.packMembers ?? [],
			riskLevel: preflight.riskLevel,
			blocked: preflight.blocked,
			label: `${slug}@${preflight.version}`,
			files: () => downloadVerified(fetchImpl, apiUrl, slug, preflight.version, preflight.sourceHash),
			receipt: (packSlug) => receiptFor(preflight, packSlug),
			verifiedLine: 'Source hash verified against the Skill Passport.',
		},
	};
}

// A repo that is not on the directory: pin, fetch, validate here, and never
// call the SkillPass API. The files in memory are the ones the hash covers.
async function repoSource(ref: string, opts: AddOptions, fetchImpl: typeof fetch, push: Push): Promise<SourceResult> {
	const parsed = parseRepoRef(ref);
	if (!parsed.ok) {
		push(`error: ${parsed.message}`);
		return { ok: false, exitCode: 2 };
	}
	const { target } = parsed;
	const commit = await resolveCommit(fetchImpl, target);
	if (!commit.ok) {
		push(`error: ${commit.message}`);
		return { ok: false, exitCode: 2 };
	}
	const fetched = await fetchRepoFiles(fetchImpl, target, commit.sha);
	if (!fetched.ok) {
		push(`error: ${fetched.message}`);
		return { ok: false, exitCode: 2 };
	}
	const pkg = loadPackageFromFiles(fetched.snapshot.files, packageNameFor(target), fetched.snapshot.binaries);
	const report = await validateLoadedPackage(pkg);
	const manifest = pkg.manifest.state === 'ok' ? pkg.manifest.data : undefined;
	const slug = manifest?.name ?? slugForSkill(packageNameFor(target));
	const origin: UnlistedOrigin = {
		repo: `${target.owner}/${target.repo}`,
		...(target.subpath ? { subpath: target.subpath } : {}),
		commit: commit.sha,
	};
	push(...renderLocalPreflight(slug, origin, pkg, report, opts.style));
	const shortSha = commit.sha.slice(0, 7);
	const version = manifest?.version ?? shortSha;
	const files = pkg.files;
	return {
		ok: true,
		source: {
			slug,
			targets: manifest?.targets ?? [],
			members: manifest?.skills ?? [],
			riskLevel: report.riskLevel,
			blocked: report.status === 'failed',
			label: `${slug} from ${originLabel(origin)}, unlisted`,
			files: async () => ({ ok: true, files }),
			receipt: (packSlug) => receiptFor({ version, sourceHash: report.sourceHash }, packSlug, origin),
			verifiedLine: `Validated locally from ${origin.repo}@${shortSha}; this install is unlisted.`,
		},
	};
}

// Exit codes are contract: 0 installed, 1 blocked, 2 refused (confirmation,
// verification, target, network). Nothing touches disk until the files to
// install are proven to match the hash the report was made from.
export async function runAdd(ref: string, opts: AddOptions = {}): Promise<CommandResult> {
	const { push, done } = createOutput(opts.emit);
	const tools = [...new Set([opts.target ?? []].flat())];

	if (tools.length > 0 && opts.dir) {
		push(TARGET_OR_DIR);
		return done(2);
	}
	if (opts.global && tools.length === 0) {
		push(GLOBAL_NEEDS_TARGET);
		return done(2);
	}
	const cwd = opts.cwd ?? process.cwd();
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	const loaded = isRepoRef(ref)
		? await repoSource(ref, opts, fetchImpl, push)
		: await directorySource(ref, opts, fetchImpl, push);
	if (!loaded.ok) {
		return done(loaded.exitCode);
	}
	const { source } = loaded;
	if (source.blocked) {
		return done(1);
	}

	const { slug, members } = source;
	const isPack = members.length > 0;

	const targets: AreaTarget[] = [];
	for (const tool of tools) {
		const resolved = resolveArea(tool, opts.global ?? false, cwd, opts.home);
		if (!resolved.ok) {
			push('', `error: ${resolved.message}`);
			return done(2);
		}
		const shared = targets.find((t) => t.area.dir === resolved.area.dir);
		if (shared) {
			push('', `note: ${tool} and ${shared.tool} share ${resolved.area.dir}; installing once`);
			continue;
		}
		targets.push({ area: resolved.area, tool });
		if (!declaresTool(source.targets, tool)) {
			push('', `warning: this skill does not declare ${tool} as a target`);
		}
	}

	const confirmed = await confirmRisk(
		source,
		opts,
		`Install ${source.label} (${source.riskLevel} risk)? [y/N] `,
		'Install aborted.',
		push,
	);
	if (!confirmed) return done(2);

	const ctx: AddContext = {
		push,
		done,
		cwd,
		home: opts.home,
		slug,
		targets: source.targets,
		files: source.files,
		receipt: source.receipt,
		verifiedLine: source.verifiedLine,
	};

	if (isPack) {
		if (targets.length > 0) {
			return installPack(ctx, members, targets);
		}
		if (opts.dir === undefined) {
			const location = await choosePackLocation(ctx, members.length, opts.promptImpl);
			return 'area' in location
				? installPack(ctx, members, [{ area: location.area, tool: location.area.tools[0] }])
				: installSingle(ctx, [location.dir]);
		}
		push(
			'',
			`note: --dir installs the raw pack source; --target <tool> installs the ${members.length} skills individually`,
		);
		return installSingle(ctx, [opts.dir]);
	}
	if (targets.length > 0) {
		return installSingle(
			ctx,
			targets.map((t) => join(t.area.dir, slug)),
		);
	}
	return installSingle(ctx, [opts.dir ?? (await chooseSingleLocation(ctx, opts.promptImpl))]);
}
