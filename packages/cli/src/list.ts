import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CommandResult } from './scan';
import { installAreas, MAPPED_TARGETS } from './targets';

export interface ListOptions {
	cwd?: string;
	home?: string;
}

interface Area {
	label: string;
	dir: string;
}

function knownAreas(cwd: string, home?: string): Area[] {
	const areas: Area[] = [];
	const byTarget = installAreas(home);
	for (const tool of MAPPED_TARGETS) {
		const area = byTarget[tool];
		if (!area) {
			continue;
		}
		areas.push({ label: `${tool} project (${area.project})`, dir: resolve(cwd, area.project) });
		if (area.global) {
			areas.push({ label: `${tool} user (${area.global})`, dir: area.global });
		}
	}
	return areas;
}

function installedIn(dir: string): string[] {
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir)
		.sort()
		.filter((name) => statSync(join(dir, name)).isDirectory());
}

// Offline by design: reports the known install areas only; --dir installs
// land wherever the user pointed and are out of its sight.
export function runList(opts: ListOptions = {}): CommandResult {
	const cwd = opts.cwd ?? process.cwd();
	const lines: string[] = [];
	for (const area of knownAreas(cwd, opts.home)) {
		const names = installedIn(area.dir);
		if (names.length === 0) {
			continue;
		}
		if (lines.length > 0) {
			lines.push('');
		}
		lines.push(area.label);
		for (const name of names) {
			lines.push(`  ${name}`);
		}
	}
	if (lines.length === 0) {
		lines.push('No skills installed in the known install areas.');
	}
	return { lines, exitCode: 0 };
}
