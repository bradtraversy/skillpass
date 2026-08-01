import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseReport } from 'skill-schema';
import { loadPackage, loadPackageFromFiles, type PackageFile } from './load';
import { buildReport, RULES, validateLoadedPackage, validatePackage } from './validate';

const fixture = (name: string) => join(import.meta.dirname, '..', 'fixtures', name);
const NOW = new Date('2026-07-03T12:00:00Z');

const MATRIX = [
	{ name: 'clean-skill', status: 'passed', riskLevel: 'low', codes: [] },
	{ name: 'workflow-pack', status: 'passed', riskLevel: 'low', codes: [] },
	{ name: 'undeclared-network', status: 'passed', riskLevel: 'low', codes: [] },
	// A bare SKILL.md gets an inferred manifest and passes. Detected capabilities are
	// informational, not a verdict; only harmful content (contentRule) fails a skill.
	{ name: 'missing-manifest', status: 'passed', riskLevel: 'low', codes: [] },
	{ name: 'inferred-critical', status: 'passed', riskLevel: 'low', codes: [] },
	{ name: 'broken-manifest', status: 'failed', riskLevel: 'high', codes: ['invalid-manifest'] },
	{ name: 'leaked-secret', status: 'failed', riskLevel: 'high', codes: ['secret-pattern'] },
	// Injection is advisory now: it publishes with a warning, not a block. Only a
	// concrete leaked secret value hard-fails.
	{ name: 'prompt-injection', status: 'warning', riskLevel: 'medium', codes: ['prompt-injection'] },
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

function readFixtureFiles(dir: string): PackageFile[] {
	return readdirSync(dir, { recursive: true, encoding: 'utf8' })
		.map((p) => p.split(sep).join('/'))
		.filter((p) => statSync(join(dir, p)).isFile())
		.map((p) => ({ path: p, content: readFileSync(join(dir, p), 'utf8') }));
}

describe('in-memory validation', () => {
	it.each(MATRIX)('$name: in-memory report equals the dir-loaded report', async ({ name }) => {
		const dir = fixture(name);
		const fromDir = await validatePackage(dir, { now: NOW });
		const fromMemory = await validateLoadedPackage(loadPackageFromFiles(readFixtureFiles(dir), dir), {
			now: NOW,
		});
		expect(fromMemory).toEqual(fromDir);
	});

	it('stepwise RULES + buildReport produces the same report as validateLoadedPackage', async () => {
		const pkg = loadPackage(fixture('undeclared-network'));
		const findings = RULES.flatMap((rule) => rule.run(pkg));
		expect(buildReport(pkg, findings, { now: NOW })).toEqual(
			await validateLoadedPackage(pkg, { now: NOW }),
		);
	});

	it('passes an inferred adapter-dir pack end to end', async () => {
		const skill = (name: string) => `---\nname: ${name}\ndescription: ${name}.\n---\nBody.\n`;
		const files: PackageFile[] = [
			{ path: '.claude/skills/plan/SKILL.md', content: skill('plan') },
			{ path: '.agents/skills/plan/SKILL.md', content: skill('plan') },
			{ path: '.claude/skills/apply/SKILL.md', content: skill('apply') },
		];
		const report = await validateLoadedPackage(loadPackageFromFiles(files, 'pack'), NOW);
		expect(report.status).toBe('passed');
		expect(report.failures).toEqual([]);
	});

	it('RULES exposes unique keys and labels for progress rendering', () => {
		expect(new Set(RULES.map((r) => r.key)).size).toBe(RULES.length);
		for (const rule of RULES) {
			expect(rule.key).not.toBe('');
			expect(rule.label).not.toBe('');
		}
	});
});

describe('report assembly', () => {
	it('stamps the injected clock, engine version, and source hash', async () => {
		const report = await validatePackage(fixture('clean-skill'), { now: NOW });
		expect(report.createdAt).toBe('2026-07-03T12:00:00.000Z');
		expect(report.engineVersion).toBe('0.3.0');
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

	it('risk follows the verdict; capabilities surface separately in permissionsDetected', async () => {
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
			// Passed -> low risk, even though it can run shell. The capability is
			// still visible in permissionsDetected, just not scored as danger.
			expect(report.riskLevel).toBe('low');
			expect(report.permissionsDetected).toEqual(['shell.execute']);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
