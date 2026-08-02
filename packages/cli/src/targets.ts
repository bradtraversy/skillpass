import { homedir } from 'node:os';
import { join } from 'node:path';
import { TARGETS, type Target } from 'skill-schema';

export interface InstallArea {
	project: string;
	global?: string;
}

// Only tools with a real skills-folder convention get an install area;
// everything else takes --dir rather than an invented path. The home dir is
// injectable so list/remove tests never touch the real ~/.claude.
export function installAreas(home: string = homedir()): Partial<Record<Target, InstallArea>> {
	return {
		'claude-code': { project: join('.claude', 'skills'), global: join(home, '.claude', 'skills') },
		codex: { project: join('.agents', 'skills') },
	};
}

export const MAPPED_TARGETS = Object.keys(installAreas()) as Target[];

export type ResolvedTarget = { ok: true; dir: string } | { ok: false; message: string };

// The skills area itself (pack fan-outs install N members into it).
export function resolveTargetArea(target: string, global = false, home?: string): ResolvedTarget {
	if (!(TARGETS as readonly string[]).includes(target)) {
		return {
			ok: false,
			message: `unknown target "${target}" (known tools: ${TARGETS.join(', ')})`,
		};
	}
	const area = installAreas(home)[target as Target];
	if (!area) {
		return {
			ok: false,
			message: `${target} has no standard skills folder yet; use --dir to pick a location`,
		};
	}
	if (global) {
		if (!area.global) {
			return {
				ok: false,
				message: `${target} has no user-level skills folder; install per project instead`,
			};
		}
		return { ok: true, dir: area.global };
	}
	return { ok: true, dir: area.project };
}

export function resolveTargetDir(
	target: string,
	slug: string,
	global = false,
	home?: string,
): ResolvedTarget {
	const area = resolveTargetArea(target, global, home);
	return area.ok ? { ok: true, dir: join(area.dir, slug) } : area;
}

// The tip shown when no --target/--dir was given but one would apply.
export function mappableDeclaredTargets(declared: Target[]): Target[] {
	return declared.filter((t) => MAPPED_TARGETS.includes(t));
}
