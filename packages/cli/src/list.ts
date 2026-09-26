import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { originLabel, readReceipts } from './receipts';
import type { CommandResult } from './scan';
import { knownAreas } from './targets';

export interface ListOptions {
	cwd?: string;
	home?: string;
}

export function installedIn(dir: string): string[] {
	if (!existsSync(dir)) {
		return [];
	}
	// A dangling symlink stats as missing; treat it as not a skill rather than crashing.
	return readdirSync(dir)
		.sort()
		.filter((name) => statSync(join(dir, name), { throwIfNoEntry: false })?.isDirectory() ?? false);
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
		const receipts = readReceipts(area.dir);
		for (const name of names) {
			const receipt = receipts[name];
			const origin = receipt?.unlisted ? `  unlisted (${originLabel(receipt.unlisted)})` : '';
			lines.push(receipt ? `  ${name}  ${receipt.version}${origin}` : `  ${name}`);
		}
	}
	if (lines.length === 0) {
		lines.push('No skills installed in the known install areas.');
	}
	return { lines, exitCode: 0 };
}
