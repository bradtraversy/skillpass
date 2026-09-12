import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { confirmRisk, createOutput, isOccupied, memberFiles, planMembers, receiptFor } from './install';

describe('createOutput', () => {
	it('buffers lines and reports them as not streamed', () => {
		const { push, done } = createOutput();
		push('a', 'b');
		push();
		expect(done(2)).toEqual({ lines: ['a', 'b'], exitCode: 2, streamed: false });
	});

	it('emits each non-empty block as it lands and still returns the transcript', () => {
		const emit = vi.fn();
		const { push, done } = createOutput(emit);
		push('a', 'b');
		push();
		push('c');
		expect(emit.mock.calls).toEqual([['a\nb'], ['c']]);
		expect(done(0)).toEqual({ lines: ['a', 'b', 'c'], exitCode: 0, streamed: true });
	});
});

describe('isOccupied', () => {
	it('is free when absent or an empty directory, occupied for a file or a non-empty directory', () => {
		const dir = mkdtempSync(join(tmpdir(), 'skillpass-occupied-'));
		mkdirSync(join(dir, 'empty'));
		mkdirSync(join(dir, 'full'));
		writeFileSync(join(dir, 'full', 'x'), '');
		writeFileSync(join(dir, 'file'), '');
		expect(isOccupied(join(dir, 'absent'))).toBe(false);
		expect(isOccupied(join(dir, 'empty'))).toBe(false);
		expect(isOccupied(join(dir, 'full'))).toBe(true);
		expect(isOccupied(join(dir, 'file'))).toBe(true);
	});
});

describe('receiptFor', () => {
	const preflight = { version: '1.2.0', sourceHash: 'sha256:abc' };

	it('stamps a single-skill receipt', () => {
		expect(receiptFor(preflight)).toEqual({
			version: '1.2.0',
			sourceHash: 'sha256:abc',
			installedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
		});
	});

	it('records the pack family on a member receipt', () => {
		expect(receiptFor(preflight, 'blueprint-pack').pack).toEqual({ slug: 'blueprint-pack', version: '1.2.0' });
	});
});

describe('memberFiles and planMembers', () => {
	const files = [
		{ path: 'README.md', content: 'pack' },
		{ path: 'skills/a/SKILL.md', content: 'a' },
		{ path: 'skills/a/notes.md', content: 'notes' },
		{ path: 'skills/b/SKILL.md', content: 'b' },
	];

	it('strips the member folder prefix and returns everything for the root', () => {
		expect(memberFiles(files, 'skills/a')).toEqual([
			{ path: 'SKILL.md', content: 'a' },
			{ path: 'notes.md', content: 'notes' },
		]);
		expect(memberFiles(files, '.')).toBe(files);
	});

	it('plans every member and leaves an unmatched one with no files', () => {
		const plans = planMembers(
			[
				{ name: 'a', sourceDir: 'skills/a' },
				{ name: 'c', sourceDir: 'skills/c' },
			],
			files,
		);
		expect(plans.map((p) => [p.name, p.files.length])).toEqual([
			['a', 2],
			['c', 0],
		]);
	});
});

describe('confirmRisk', () => {
	const ask = 'Install? [y/N] ';

	it('needs no prompt for low risk or with --yes', async () => {
		const { push, done } = createOutput();
		expect(await confirmRisk({ riskLevel: 'low' }, {}, ask, 'aborted', push)).toBe(true);
		expect(await confirmRisk({ riskLevel: 'high' }, { yes: true }, ask, 'aborted', push)).toBe(true);
		expect(done(0).lines).toEqual([]);
	});

	it('refuses without a way to ask', async () => {
		const { push, done } = createOutput();
		expect(await confirmRisk({ riskLevel: 'high' }, {}, ask, 'aborted', push)).toBe(false);
		expect(done(2).lines[1]).toBe('error: a high-risk skill needs confirmation; rerun with --yes');
	});

	it('asks the exact question and honors the answer', async () => {
		const { push, done } = createOutput();
		const confirmImpl = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		expect(await confirmRisk({ riskLevel: 'medium' }, { confirmImpl }, ask, 'aborted', push)).toBe(true);
		expect(await confirmRisk({ riskLevel: 'medium' }, { confirmImpl }, ask, 'aborted', push)).toBe(false);
		expect(confirmImpl).toHaveBeenCalledWith(ask);
		expect(done(2).lines).toEqual(['', 'aborted']);
	});
});
