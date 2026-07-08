import { strFromU8, unzipSync } from 'fflate';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { Target } from 'skill-schema';
import { loadPackageFromFiles, type PackageFile } from 'validator';
import { fetchPreflight, resolveApiUrl } from './api';
import { renderPreflightReport } from './render';
import type { CommandResult } from './scan';
import { mappableDeclaredTargets, resolveTargetDir } from './targets';

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
	// Streams lines as they happen so interactive prompts appear AFTER the
	// pre-flight report, not before it. Lines are still returned for tests.
	emit?: (text: string) => void;
}

function unsafeEntryPath(path: string): boolean {
	return isAbsolute(path) || path.split('/').includes('..') || path.includes('\\');
}

interface InstallChoice {
	label: string;
	dir: string;
}

export function installChoices(declared: Target[], slug: string): InstallChoice[] {
	const choices: InstallChoice[] = [];
	for (const tool of mappableDeclaredTargets(declared)) {
		const resolved = resolveTargetDir(tool, slug);
		if (resolved.ok) {
			choices.push({ label: `${tool} skills folder (${resolved.dir})`, dir: resolved.dir });
		}
		const global = resolveTargetDir(tool, slug, true);
		if (global.ok) {
			choices.push({ label: `${tool} user-level skills folder (${global.dir})`, dir: global.dir });
		}
	}
	choices.push({ label: `current directory (./${slug})`, dir: slug });
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
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	const apiUrl = resolveApiUrl(opts.apiUrl);
	const fetched = await fetchPreflight(fetchImpl, apiUrl, ref);
	if (!fetched.ok) {
		push(...fetched.result.lines);
		return done(fetched.result.exitCode);
	}
	const { slug, detail, preflight } = fetched;
	push(...renderPreflightReport(detail, preflight));

	if (preflight.blocked) {
		return done(1);
	}

	let targetDir = opts.dir;
	if (opts.target) {
		const resolved = resolveTargetDir(opts.target, slug, opts.global);
		if (!resolved.ok) {
			push('', `error: ${resolved.message}`);
			return done(2);
		}
		targetDir = resolved.dir;
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

	if (!targetDir) {
		const choices = installChoices(detail.targets, slug);
		if (opts.promptImpl && choices.length > 1) {
			push('', 'Install location:');
			choices.forEach((choice, i) => push(`  ${i + 1}) ${choice.label}`));
			const answer = await opts.promptImpl(`Where should it go? [1-${choices.length}, default 1] `);
			const index = Number.parseInt(answer.trim(), 10) - 1;
			targetDir = (choices[index] ?? choices[0]).dir;
		} else {
			targetDir = slug;
			const mappable = mappableDeclaredTargets(detail.targets);
			if (mappable.length > 0) {
				push('', `tip: --target ${mappable[0]} installs into the tool's skills folder`);
			}
		}
	}
	const target = resolve(opts.cwd ?? process.cwd(), targetDir);
	if (existsSync(target) && readdirSync(target).length > 0) {
		push('', `error: target directory ${target} already exists and is not empty`);
		return done(2);
	}

	const downloadUrl = `${apiUrl}/skills/${encodeURIComponent(slug)}/${encodeURIComponent(preflight.version)}/download?source=cli`;
	let res: Response;
	try {
		res = await fetchImpl(downloadUrl);
	} catch {
		push('', `error: cannot reach the API at ${downloadUrl}`);
		return done(2);
	}
	if (!res.ok) {
		push('', `error: download failed (${res.status})`);
		return done(2);
	}

	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(new Uint8Array(await res.arrayBuffer()));
	} catch {
		push('', 'error: the download was not a valid zip');
		return done(2);
	}
	const files: PackageFile[] = Object.entries(entries).map(([path, data]) => ({
		path,
		content: strFromU8(data),
	}));
	const unsafe = files.find((f) => unsafeEntryPath(f.path));
	if (unsafe) {
		push('', `error: refusing unsafe entry path "${unsafe.path}" in the download`);
		return done(2);
	}
	if (loadPackageFromFiles(files).sourceHash !== preflight.sourceHash) {
		push('', 'error: the downloaded files do not match the pinned source hash; nothing was installed');
		return done(2);
	}

	for (const file of files) {
		const filePath = join(target, file.path);
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(filePath, file.content);
	}

	push(
		'',
		`Installed ${files.length} file(s) to ${target}`,
		'Source hash verified against the Skill Passport.',
	);
	return done(0);
}
