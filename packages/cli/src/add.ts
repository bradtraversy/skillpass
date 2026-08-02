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
import type { Target } from 'skill-schema';
import { loadPackageFromFiles, type PackageFile } from 'validator';
import { fetchPreflight, resolveApiUrl } from './api';
import { resolvePackMembers } from './pack';
import { renderPreflightReport } from './render';
import type { CommandResult } from './scan';
import type { Styler } from './style';
import {
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

type Download = { ok: true; files: PackageFile[] } | { ok: false; message: string };

// Download the version snapshot and prove it is byte-identical to what the
// validator saw; no caller writes anything on a not-ok result.
async function downloadVerified(
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
function writeTree(files: PackageFile[], target: string): void {
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

function memberFiles(files: PackageFile[], sourceDir: string): PackageFile[] {
	if (sourceDir === '.') {
		return files;
	}
	const prefix = `${sourceDir}/`;
	return files
		.filter((f) => f.path.startsWith(prefix))
		.map((f) => ({ path: f.path.slice(prefix.length), content: f.content }));
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

export function packChoices(declared: Target[], slug: string, count: number): PackChoice[] {
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

// Exit codes are contract: 0 installed, 1 blocked, 2 refused (confirmation,
// verification, target, network). Nothing touches disk until the downloaded
// bytes re-verify against the pinned source hash.
export async function runAdd(ref: string, opts: AddOptions = {}): Promise<CommandResult> {
	const lines: string[] = [];
	const streamed = opts.emit !== undefined;
	const push = (...next: string[]) => {
		lines.push(...next);
		if (next.length > 0) {
			opts.emit?.(next.join('\n'));
		}
	};
	const done = (exitCode: number): CommandResult => ({ lines, exitCode, streamed });

	if (opts.target && opts.dir) {
		push('error: pass --target or --dir, not both');
		return done(2);
	}
	if (opts.global && !opts.target) {
		push('error: --global needs --target (e.g. --target claude-code)');
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
	let packTool: string | undefined;
	let packGlobal = false;

	if (opts.target) {
		const resolved = isPack
			? resolveTargetArea(opts.target, opts.global)
			: resolveTargetDir(opts.target, slug, opts.global);
		if (!resolved.ok) {
			push('', `error: ${resolved.message}`);
			return done(2);
		}
		if (isPack) {
			packTool = opts.target;
			packGlobal = opts.global ?? false;
		} else {
			targetDir = resolved.dir;
		}
		if (!(detail.targets as string[]).includes(opts.target)) {
			push('', `warning: this skill does not declare ${opts.target} as a target`);
		}
	}

	if (preflight.riskLevel !== 'low' && !opts.yes) {
		if (!opts.confirmImpl) {
			push('', `error: a ${preflight.riskLevel}-risk skill needs confirmation; rerun with --yes`);
			return done(2);
		}
		const confirmed = await opts.confirmImpl(
			`Install ${slug}@${preflight.version} (${preflight.riskLevel} risk)? [y/N] `,
		);
		if (!confirmed) {
			push('', 'Install aborted.');
			return done(2);
		}
	}

	const prompt = opts.promptImpl;
	const promptIndex = async (ask: (question: string) => Promise<string>, count: number) => {
		while (true) {
			const answer = (await ask(`Where should it go? [1-${count}, default 1] `)).trim();
			if (answer === '') {
				return 0;
			}
			const index = /^\d+$/.test(answer) ? Number.parseInt(answer, 10) - 1 : -1;
			if (index >= 0 && index < count) {
				return index;
			}
			push(`  answer 1-${count}, or press enter for the default`);
		}
	};

	if (isPack && packTool === undefined && targetDir === undefined) {
		if (prompt) {
			const choices = packChoices(detail.targets, slug, members.length);
			push('', 'Install location:');
			choices.forEach((choice, i) => push(`  ${i + 1}) ${choice.label}`));
			const chosen = choices[await promptIndex(prompt, choices.length)];
			if (chosen.tool) {
				packTool = chosen.tool;
				packGlobal = chosen.global ?? false;
			} else {
				targetDir = slug;
			}
		} else {
			targetDir = slug;
			const mappable = mappableDeclaredTargets(detail.targets);
			if (mappable.length > 0) {
				push(
					'',
					`tip: --target ${mappable[0]} installs the ${members.length} skills into the tool's skills folder`,
				);
			}
		}
	}

	if (packTool !== undefined) {
		const area = resolveTargetArea(packTool, packGlobal);
		if (!area.ok) {
			push('', `error: ${area.message}`);
			return done(2);
		}
		const { installs, skipped } = resolvePackMembers(members, packTool);
		if (installs.length === 0) {
			push('', `error: none of this pack's skills support ${packTool}`);
			return done(2);
		}
		const areaAbs = resolve(opts.cwd ?? process.cwd(), area.dir);
		const conflicts = installs
			.map((m) => join(areaAbs, m.name))
			.filter(
				(dest) =>
					existsSync(dest) && (!statSync(dest).isDirectory() || readdirSync(dest).length > 0),
			);
		if (conflicts.length > 0) {
			push(
				'',
				'error: these destinations already exist and are not empty; nothing was installed:',
				...conflicts.map((c) => `  ${c}`),
			);
			return done(2);
		}
		const download = await downloadVerified(
			fetchImpl,
			apiUrl,
			slug,
			preflight.version,
			preflight.sourceHash,
		);
		if (!download.ok) {
			push('', `error: ${download.message}`);
			return done(2);
		}
		const plans = installs.map((m) => ({ ...m, files: memberFiles(download.files, m.sourceDir) }));
		const missing = plans.find((p) => p.files.length === 0);
		if (missing) {
			push('', `error: the snapshot has no files for "${missing.name}"; nothing was installed`);
			return done(2);
		}
		for (const name of skipped) {
			push('', `note: ${name} does not support ${packTool}; skipped`);
		}
		const written: string[] = [];
		try {
			for (const plan of plans) {
				writeTree(plan.files, join(areaAbs, plan.name));
				written.push(plan.name);
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

	if (isPack && opts.dir) {
		push(
			'',
			`note: --dir installs the raw pack source; --target <tool> installs the ${members.length} skills individually`,
		);
	}

	if (!targetDir) {
		const choices = installChoices(detail.targets, slug);
		if (prompt && choices.length > 1) {
			push('', 'Install location:');
			choices.forEach((choice, i) => push(`  ${i + 1}) ${choice.label}`));
			targetDir = choices[await promptIndex(prompt, choices.length)].dir;
		} else {
			targetDir = slug;
			const mappable = mappableDeclaredTargets(detail.targets);
			if (mappable.length > 0) {
				push('', `tip: --target ${mappable[0]} installs into the tool's skills folder`);
			}
		}
	}
	const target = resolve(opts.cwd ?? process.cwd(), targetDir);
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

	const download = await downloadVerified(
		fetchImpl,
		apiUrl,
		slug,
		preflight.version,
		preflight.sourceHash,
	);
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

	push(
		'',
		`Installed ${download.files.length} file(s) to ${target}`,
		'Source hash verified against the Skill Passport.',
	);
	return done(0);
}
