import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Where an install that is not on the directory came from; commit is the full sha.
export interface UnlistedOrigin {
	repo: string;
	subpath?: string;
	commit: string;
}

export interface Receipt {
	version: string;
	sourceHash: string;
	installedAt: string;
	// Present on pack members, so pack-level update/remove can find the family.
	pack?: { slug: string; version: string };
	// Present on installs validated locally from a repo (never on directory installs).
	unlisted?: UnlistedOrigin;
}

export function originLabel(origin: UnlistedOrigin): string {
	return origin.subpath ? `${origin.repo}/${origin.subpath}` : origin.repo;
}

export type ReceiptIndex = Record<string, Receipt>;

export const RECEIPT_FILE = '.skillpass.json';

function looksLikeReceipt(value: unknown): value is Receipt {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Receipt).version === 'string' &&
		typeof (value as Receipt).sourceHash === 'string'
	);
}

// A broken index must never break a command: unreadable or malformed data
// reads as "no receipts", entry by entry.
export function readReceipts(areaDir: string): ReceiptIndex {
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(join(areaDir, RECEIPT_FILE), 'utf8'));
	} catch {
		return {};
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return {};
	}
	const index: ReceiptIndex = {};
	for (const [slug, receipt] of Object.entries(parsed as Record<string, unknown>)) {
		if (looksLikeReceipt(receipt)) {
			index[slug] = receipt;
		}
	}
	return index;
}

function writeReceipts(areaDir: string, index: ReceiptIndex): void {
	try {
		mkdirSync(areaDir, { recursive: true });
		writeFileSync(join(areaDir, RECEIPT_FILE), `${JSON.stringify(index, null, '\t')}\n`);
	} catch {
		// Receipts are bookkeeping; the install/remove itself already succeeded.
	}
}

export function recordReceipt(areaDir: string, slug: string, receipt: Receipt): void {
	const index = readReceipts(areaDir);
	index[slug] = receipt;
	writeReceipts(areaDir, index);
}

export function removeReceipt(areaDir: string, slug: string): void {
	const index = readReceipts(areaDir);
	if (!(slug in index)) {
		return;
	}
	delete index[slug];
	writeReceipts(areaDir, index);
}
