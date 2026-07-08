import { homedir } from 'node:os';
import { join } from 'node:path';
import { TARGETS, type Target } from 'skill-schema';

// Only tools with a real skills-folder convention get an install area;
// everything else takes --dir rather than an invented path.
const INSTALL_AREAS: Partial<Record<Target, { project: string; global?: string }>> = {
	'claude-code': { project: join('.claude', 'skills'), global: join(homedir(), '.claude', 'skills') },
	codex: { project: join('.agents', 'skills') },
};

export const MAPPED_TARGETS = Object.keys(INSTALL_AREAS) as Target[];

export type ResolvedTarget = { ok: true; dir: string } | { ok: false; message: string };

export function resolveTargetDir(target: string, slug: string, global = false): ResolvedTarget {
	if (!(TARGETS as readonly string[]).includes(target)) {
		return {
			ok: false,
			message: `unknown target "${target}" (known tools: ${TARGETS.join(', ')})`,
		};
	}
	const area = INSTALL_AREAS[target as Target];
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
		return { ok: true, dir: join(area.global, slug) };
	}
	return { ok: true, dir: join(area.project, slug) };
}

// The tip shown when no --target/--dir was given but one would apply.
export function mappableDeclaredTargets(declared: Target[]): Target[] {
	return declared.filter((t) => MAPPED_TARGETS.includes(t));
}
