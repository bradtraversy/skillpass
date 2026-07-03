import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseReport } from 'skill-schema';
import { validatePackage } from './validate';

const fixture = (name: string) => join(import.meta.dirname, '..', 'fixtures', name);
const NOW = new Date('2026-07-03T12:00:00Z');

const MATRIX = [
	{ name: 'clean-skill', status: 'passed', riskLevel: 'low', codes: [] },
	{ name: 'workflow-pack', status: 'passed', riskLevel: 'low', codes: [] },
	{ name: 'undeclared-network', status: 'warning', riskLevel: 'low', codes: ['undeclared-permission'] },
	{ name: 'missing-manifest', status: 'warning', riskLevel: 'low', codes: ['missing-manifest'] },
	{ name: 'broken-manifest', status: 'failed', riskLevel: 'low', codes: ['invalid-manifest'] },
	{ name: 'leaked-secret', status: 'failed', riskLevel: 'low', codes: ['secret-pattern'] },
	{ name: 'prompt-injection', status: 'failed', riskLevel: 'low', codes: ['prompt-injection'] },
] as const;

describe('fixture matrix', () => {
	it.each(MATRIX)('$name -> $status', async ({ name, status, riskLevel, codes }) => {
		const report = await validatePackage(fixture(name), { now: NOW });
		expect(report.status).toBe(status);
		expect(report.riskLevel).toBe(riskLevel);
		const allCodes = [...report.warnings, ...report.failures].map((f) => f.code);
		for (const code of codes) {
			expect(allCodes).toContain(code);
		}
	});
});

describe('report assembly', () => {
	it('stamps the injected clock, engine version, and source hash', async () => {
		const report = await validatePackage(fixture('clean-skill'), { now: NOW });
		expect(report.createdAt).toBe('2026-07-03T12:00:00.000Z');
		expect(report.engineVersion).toBe('0.1.0');
		expect(report.sourceHash).toMatch(/^sha256:/);
	});

	it('is deterministic for the same input and clock', async () => {
		const a = await validatePackage(fixture('undeclared-network'), { now: NOW });
		const b = await validatePackage(fixture('undeclared-network'), { now: NOW });
		expect(a).toEqual(b);
	});

	it('round-trips through parseReport', async () => {
		const report = await validatePackage(fixture('leaked-secret'), { now: NOW });
		const parsed = parseReport(JSON.parse(JSON.stringify(report)));
		expect(parsed.success).toBe(true);
	});

	it('separates risk from status: a declared critical permission passes at high risk', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'validator-declared-'));
		try {
			writeFileSync(
				join(dir, 'skill.json'),
				JSON.stringify({
					schemaVersion: '0.1',
					name: 'declared-shell',
					description: 'Declares the shell access it uses.',
					targets: ['claude-code'],
					permissions: ['shell.execute'],
				}),
			);
			mkdirSync(join(dir, 'docs'));
			writeFileSync(join(dir, 'SKILL.md'), '# declared-shell\n\nRun the build command for the user.\n');
			const report = await validatePackage(dir, { now: NOW });
			expect(report.status).toBe('passed');
			expect(report.riskLevel).toBe('high');
			expect(report.permissionsDetected).toEqual(['shell.execute']);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
