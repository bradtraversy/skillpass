import { existsSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { readReceipts, removeReceipt } from './receipts';
import type { CommandResult } from './scan';
import { installAreas, knownAreas, MAPPED_TARGETS, resolveTargetDir } from './targets';

export interface RemoveOptions {
	target?: string;
	dir?: string;
	global?: boolean;
	cwd?: string;
	home?: string;
}

function looksLikeInstalledSkill(dir: string): boolean {
	return existsSync(join(dir, 'SKILL.md')) || existsSync(join(dir, 'skill.json'));
}

// Candidate locations for a no-flag remove: every known install area plus
// ./<slug>, mirroring where add can put things without --dir.
function candidateDirs(slug: string, cwd: string, home?: string): string[] {
	const dirs: string[] = [];
	const byTarget = installAreas(home);
	for (const tool of MAPPED_TARGETS) {
		const area = byTarget[tool];
		if (!area) {
			continue;
		}
		dirs.push(resolve(cwd, join(area.project, slug)));
		if (area.global) {
			dirs.push(join(area.global, slug));
		}
	}
	dirs.push(resolve(cwd, slug));
	return [...new Set(dirs)];
}

// Exit codes are contract: 0 removed, 2 anything else (usage, not installed,
// ambiguous, refused). Nothing is deleted unless the directory carries an
// installed-skill marker, so a stray --dir can never be wiped recursively.
export function runRemove(slug: string, opts: RemoveOptions = {}): CommandResult {
	if (opts.target && opts.dir) {
		return { lines: ['error: pass --target or --dir, not both'], exitCode: 2 };
	}
	if (opts.global && !opts.target) {
		return { lines: ['error: --global needs --target (e.g. --target claude-code)'], exitCode: 2 };
	}
	const cwd = opts.cwd ?? process.cwd();

	// A pack removes as a family: every member recorded for it in the area.
	if (!opts.dir) {
		let areas = knownAreas(cwd, opts.home);
		if (opts.target) {
			areas = areas.filter((a) => a.tool === opts.target && a.global === (opts.global ?? false));
		}
		const packHits = areas
			.map((area) => ({
				area,
				members: Object.entries(readReceipts(area.dir))
					.filter(([, r]) => r.pack?.slug === slug)
					.map(([name]) => name),
			}))
			.filter((hit) => hit.members.length > 0);
		if (packHits.length > 1) {
			return {
				lines: [
					`error: the ${slug} pack is installed in more than one place; pick one with --target:`,
					...packHits.map((hit) => `  ${hit.area.dir}`),
				],
				exitCode: 2,
			};
		}
		if (packHits.length === 1) {
			const { area, members } = packHits[0];
			for (const name of members) {
				rmSync(join(area.dir, name), { recursive: true, force: true });
				removeReceipt(area.dir, name);
			}
			return {
				lines: [
					`Removed pack ${slug} (${members.length} skills) from ${area.dir}`,
					`  ${members.sort().join(', ')}`,
				],
				exitCode: 0,
			};
		}
	}

	let dir: string;
	if (opts.target) {
		const resolved = resolveTargetDir(opts.target, slug, opts.global, opts.home);
		if (!resolved.ok) {
			return { lines: [`error: ${resolved.message}`], exitCode: 2 };
		}
		dir = resolve(cwd, resolved.dir);
	} else if (opts.dir) {
		dir = resolve(cwd, opts.dir);
	} else {
		const found = candidateDirs(slug, cwd, opts.home).filter((candidate) =>
			existsSync(candidate),
		);
		if (found.length === 0) {
			return { lines: [`error: ${slug} is not installed in any known location`], exitCode: 2 };
		}
		if (found.length > 1) {
			return {
				lines: [
					`error: ${slug} is installed in more than one place; pick one with --target or --dir:`,
					...found.map((candidate) => `  ${candidate}`),
				],
				exitCode: 2,
			};
		}
		dir = found[0];
	}

	if (!existsSync(dir)) {
		return { lines: [`error: nothing installed at ${dir}`], exitCode: 2 };
	}
	if (!statSync(dir).isDirectory()) {
		return { lines: [`error: ${dir} is not a directory`], exitCode: 2 };
	}
	if (!looksLikeInstalledSkill(dir)) {
		return {
			lines: [`error: ${dir} does not look like an installed skill (no SKILL.md or skill.json); not removing`],
			exitCode: 2,
		};
	}

	rmSync(dir, { recursive: true });
	removeReceipt(dirname(dir), slug);
	return { lines: [`Removed ${slug} from ${dir}`], exitCode: 0 };
}
