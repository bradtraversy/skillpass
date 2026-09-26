import type { UnzipFileFilter } from 'fflate';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { PublicPreflight } from 'skill-schema';
import type { PackageFile } from 'validator';
import type { PackMemberInstall } from './pack';
import type { Receipt, UnlistedOrigin } from './receipts';
import type { CommandResult } from './scan';

export const GLOBAL_NEEDS_TARGET = 'error: --global needs --target (e.g. --target claude-code)';
export const TARGET_OR_DIR = 'error: pass --target or --dir, not both';

// Mirror the server snapshot caps (apps/api/src/github/snapshot.ts) so the CLI
// never trusts an oversized archive, from the API or straight from GitHub.
export const MAX_FILES = 500;
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_ZIP_BYTES = 20 * 1024 * 1024;

export class OversizedArchiveError extends Error {}

export function unsafeEntryPath(path: string): boolean {
	return isAbsolute(path) || path.split('/').includes('..') || path.includes('\\');
}

// An unzip filter that keeps the entries `keep` accepts and throws
// OversizedArchiveError the moment those entries exceed the caps.
export function cappedFilter(keep: (name: string) => boolean = () => true): UnzipFileFilter {
	let fileCount = 0;
	let totalBytes = 0;
	return (info) => {
		if (!keep(info.name)) return false;
		fileCount += 1;
		totalBytes += info.originalSize;
		if (fileCount > MAX_FILES || info.originalSize > MAX_FILE_BYTES || totalBytes > MAX_TOTAL_BYTES) {
			throw new OversizedArchiveError();
		}
		return true;
	};
}

// A streamed command emits each block as it lands and still returns the full
// transcript; a buffered one returns it for main to print.
export function createOutput(emit?: (text: string) => void) {
	const lines: string[] = [];
	const streamed = emit !== undefined;
	const push = (...next: string[]): void => {
		lines.push(...next);
		if (next.length > 0) emit?.(next.join('\n'));
	};
	const done = (exitCode: number): CommandResult => ({ lines, exitCode, streamed });
	return { push, done };
}

export type Push = ReturnType<typeof createOutput>['push'];

// A destination is free when it is absent or an empty directory.
export function isOccupied(path: string): boolean {
	return existsSync(path) && (!statSync(path).isDirectory() || readdirSync(path).length > 0);
}

export function receiptFor(
	source: Pick<PublicPreflight, 'version' | 'sourceHash'>,
	packSlug?: string,
	unlisted?: UnlistedOrigin,
): Receipt {
	return {
		version: source.version,
		sourceHash: source.sourceHash,
		installedAt: new Date().toISOString(),
		...(packSlug ? { pack: { slug: packSlug, version: source.version } } : {}),
		...(unlisted ? { unlisted } : {}),
	};
}

export function memberFiles(files: PackageFile[], sourceDir: string): PackageFile[] {
	if (sourceDir === '.') {
		return files;
	}
	const prefix = `${sourceDir}/`;
	return files
		.filter((f) => f.path.startsWith(prefix))
		.map((f) => ({ path: f.path.slice(prefix.length), content: f.content }));
}

export interface MemberPlan extends PackMemberInstall {
	files: PackageFile[];
}

// One plan per member from the pack snapshot; a member with no files means the
// snapshot and the manifest disagree, so the caller installs nothing.
export function planMembers(installs: PackMemberInstall[], files: PackageFile[]): MemberPlan[] {
	return installs.map((m) => ({ ...m, files: memberFiles(files, m.sourceDir) }));
}

export interface RiskPrompt {
	yes?: boolean;
	confirmImpl?: (question: string) => Promise<boolean>;
}

// Anything above low risk needs an explicit yes unless --yes was passed. A
// false return means stop with exit 2; the reason has already been pushed.
export async function confirmRisk(
	preflight: Pick<PublicPreflight, 'riskLevel'>,
	opts: RiskPrompt,
	question: string,
	abortLine: string,
	push: Push,
): Promise<boolean> {
	if (preflight.riskLevel === 'low' || opts.yes) return true;
	if (!opts.confirmImpl) {
		push('', `error: a ${preflight.riskLevel}-risk skill needs confirmation; rerun with --yes`);
		return false;
	}
	if (await opts.confirmImpl(question)) return true;
	push('', abortLine);
	return false;
}
