import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { originLabel, readReceipts, RECEIPT_FILE, recordReceipt, removeReceipt } from './receipts';

const temp = () => mkdtempSync(join(tmpdir(), 'skillpass-receipts-'));

const receipt = {
	version: '1.0.0',
	sourceHash: 'sha256:abc',
	installedAt: '2026-08-02T12:00:00.000Z',
};

describe('receipts', () => {
	it('round-trips record and read', () => {
		const dir = temp();
		recordReceipt(dir, 'demo', receipt);
		expect(readReceipts(dir)).toEqual({ demo: receipt });
	});

	it('removes a single entry and keeps the rest', () => {
		const dir = temp();
		recordReceipt(dir, 'demo', receipt);
		recordReceipt(dir, 'other', { ...receipt, version: '2.0.0' });
		removeReceipt(dir, 'demo');
		expect(Object.keys(readReceipts(dir))).toEqual(['other']);
	});

	it('reads an absent or corrupt index as empty', () => {
		const dir = temp();
		expect(readReceipts(dir)).toEqual({});
		writeFileSync(join(dir, RECEIPT_FILE), 'not json at all');
		expect(readReceipts(dir)).toEqual({});
	});

	it('filters malformed entries but keeps valid ones', () => {
		const dir = temp();
		writeFileSync(join(dir, RECEIPT_FILE), JSON.stringify({ good: receipt, bad: { version: 42 }, worse: 'nope' }));
		expect(Object.keys(readReceipts(dir))).toEqual(['good']);
	});

	it('keeps pack membership on member receipts', () => {
		const dir = temp();
		recordReceipt(dir, 'adopt', { ...receipt, pack: { slug: 'blueprint', version: '1.0.0' } });
		expect(readReceipts(dir).adopt.pack).toEqual({ slug: 'blueprint', version: '1.0.0' });
		expect(readFileSync(join(dir, RECEIPT_FILE), 'utf8')).toContain('"blueprint"');
	});

	it('round-trips the unlisted origin and still reads receipts without it', () => {
		const dir = temp();
		const unlisted = { repo: 'o/r', subpath: 'skills/pdf', commit: 'a'.repeat(40) };
		recordReceipt(dir, 'pdf', { ...receipt, unlisted });
		recordReceipt(dir, 'listed', receipt);
		const index = readReceipts(dir);
		expect(index.pdf.unlisted).toEqual(unlisted);
		expect(index.listed.unlisted).toBeUndefined();
		expect(originLabel(unlisted)).toBe('o/r/skills/pdf');
		expect(originLabel({ repo: 'o/r', commit: 'abc' })).toBe('o/r');
	});
});
