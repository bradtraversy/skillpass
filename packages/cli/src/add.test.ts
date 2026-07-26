import { strToU8, zipSync } from 'fflate';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { PublicPreflight, PublicSkillDetail } from 'skill-schema';
import { loadPackageFromFiles } from 'validator';
import { describe, expect, it, vi } from 'vitest';
import { installChoices, runAdd } from './add';

const FILES = [
	{ path: 'SKILL.md', content: '# smoke-clean\n' },
	{ path: 'skill.json', content: '{"name":"smoke-clean"}' },
];
const REAL_HASH = loadPackageFromFiles(FILES).sourceHash;
const ZIP = zipSync(Object.fromEntries(FILES.map((f) => [f.path, strToU8(f.content)])));

const detail: PublicSkillDetail = {
	slug: 'smoke-clean',
	name: 'smoke-clean',
	summary: 'Clean smoke-test skill.',
	targets: ['claude-code'],
	validationStatus: 'passed',
	riskLevel: 'low',
	version: '1.0.0',
	maintainer: 'bradtraversy',
	attributedTo: null,
	featured: false,
	verified: false,
	publishedAt: '2026-07-07T18:24:19.337Z',
	githubRepoUrl: null,
	passport: {
		schemaVersion: '0.1',
		validationStatus: 'passed',
		riskLevel: 'low',
		permissionsSummary: { declared: [], detected: [] },
		warningsSummary: [],
		distribution: 'skill',
		manifestInferred: false,
		sourceHash: REAL_HASH,
		engineVersion: 'validator-0.1.0',
		generatedAt: '2026-07-07T18:24:19.337Z',
	},
	maintainerInfo: {
		username: 'bradtraversy',
		displayName: 'Brad Traversy',
		avatarUrl: 'https://example.com/a.png',
	},
	versions: [
		{ version: '1.0.0', validationStatus: 'passed', riskLevel: 'low', publishedAt: '2026-07-07T18:24:19.337Z' },
	],
	aiReview: null,
};

const preflight: PublicPreflight = {
	version: '1.0.0',
	validationStatus: 'passed',
	riskLevel: 'low',
	sourceHash: REAL_HASH,
	sourceVerified: true,
	resolvedCommitSha: null,
	generatedAt: '2026-07-07T18:24:19.337Z',
	permissions: { declared: [], detected: [] },
	diff: null,
	blocked: false,
	blockedReason: null,
};

function stubFetch(overrides: { preflight?: PublicPreflight; zip?: Uint8Array } = {}) {
	const pf = overrides.preflight ?? preflight;
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes('/download')) {
			const body = overrides.zip ?? ZIP;
			return new Response(body.slice().buffer as ArrayBuffer, { status: 200 });
		}
		if (url.endsWith('/preflight')) {
			return new Response(JSON.stringify({ success: true, data: pf }), { status: 200 });
		}
		return new Response(JSON.stringify({ success: true, data: detail }), { status: 200 });
	}) as unknown as typeof fetch;
}

const tempTarget = () => join(mkdtempSync(join(tmpdir(), 'skillpass-add-')), 'skill');

describe('runAdd', () => {
	it('installs verified files and exits 0', async () => {
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', { dir, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain('Installed 2 file(s)');
		expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toBe('# smoke-clean\n');
		expect(readFileSync(join(dir, 'skill.json'), 'utf8')).toBe('{"name":"smoke-clean"}');
	});

	it('refuses a hash mismatch and writes nothing', async () => {
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', {
			dir,
			fetchImpl: stubFetch({ preflight: { ...preflight, sourceHash: 'sha256:other' } }),
		});
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('do not match the pinned source hash');
		expect(existsSync(dir)).toBe(false);
	});

	it('refuses a blocked version without downloading', async () => {
		const fetchImpl = stubFetch({
			preflight: {
				...preflight,
				validationStatus: 'failed',
				blocked: true,
				blockedReason: 'failed validation',
			},
		});
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', { dir, fetchImpl });
		expect(result.exitCode).toBe(1);
		expect(result.lines.join('\n')).toContain('BLOCKED');
		const urls = vi.mocked(fetchImpl).mock.calls.map((c) => String(c[0]));
		expect(urls.some((u) => u.includes('/download'))).toBe(false);
	});

	it('refuses a non-empty target directory', async () => {
		const dir = tempTarget();
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, 'existing.txt'), 'here first');
		const result = await runAdd('smoke-clean', { dir, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('not empty');
	});

	it('rejects unsafe entry paths in the zip', async () => {
		const evil = zipSync({ '../evil.txt': strToU8('gotcha') });
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', { dir, fetchImpl: stubFetch({ zip: evil }) });
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('unsafe entry path');
		expect(existsSync(dir)).toBe(false);
	});

	it('requires confirmation for medium risk and aborts on no', async () => {
		const confirmImpl = vi.fn(async () => false);
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', {
			dir,
			fetchImpl: stubFetch({ preflight: { ...preflight, riskLevel: 'medium' } }),
			confirmImpl,
		});
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('Install aborted');
		expect(confirmImpl).toHaveBeenCalledOnce();
		expect(existsSync(dir)).toBe(false);
	});

	it('skips confirmation with --yes', async () => {
		const confirmImpl = vi.fn(async () => false);
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', {
			dir,
			yes: true,
			fetchImpl: stubFetch({ preflight: { ...preflight, riskLevel: 'medium' } }),
			confirmImpl,
		});
		expect(result.exitCode).toBe(0);
		expect(confirmImpl).not.toHaveBeenCalled();
	});

	it('exits 2 for medium risk with no way to confirm', async () => {
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', {
			dir,
			fetchImpl: stubFetch({ preflight: { ...preflight, riskLevel: 'medium' } }),
		});
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('rerun with --yes');
	});

	it('installs into .claude/skills with --target claude-code', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-target-'));
		const result = await runAdd('smoke-clean', {
			target: 'claude-code',
			cwd,
			fetchImpl: stubFetch(),
		});
		expect(result.exitCode).toBe(0);
		expect(readFileSync(join(cwd, '.claude', 'skills', 'smoke-clean', 'SKILL.md'), 'utf8')).toBe(
			'# smoke-clean\n',
		);
	});

	it('warns when the chosen target is not declared by the skill', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-target-'));
		const result = await runAdd('smoke-clean', { target: 'codex', cwd, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain('does not declare codex');
		expect(readFileSync(join(cwd, '.agents', 'skills', 'smoke-clean', 'SKILL.md'), 'utf8')).toBe(
			'# smoke-clean\n',
		);
	});

	it('rejects --target together with --dir', async () => {
		const result = await runAdd('smoke-clean', {
			target: 'claude-code',
			dir: './x',
			fetchImpl: stubFetch(),
		});
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('not both');
	});

	it('exits 2 for a tool without an install area, naming --dir', async () => {
		const result = await runAdd('smoke-clean', { target: 'cursor', fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('use --dir');
	});

	it('tips the mappable target on a default install without a prompt', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-tip-'));
		const result = await runAdd('smoke-clean', { cwd, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain('tip: --target claude-code');
	});

	it('asks where to install when interactive and honors the choice', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-ask-'));
		const promptImpl = vi.fn(async () => '1');
		const result = await runAdd('smoke-clean', { cwd, promptImpl, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain('Install location:');
		expect(promptImpl).toHaveBeenCalledOnce();
		expect(existsSync(join(cwd, '.claude', 'skills', 'smoke-clean', 'SKILL.md'))).toBe(true);
	});

	it('defaults to the first choice on an empty answer', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-ask-'));
		const result = await runAdd('smoke-clean', {
			cwd,
			promptImpl: async () => '',
			fetchImpl: stubFetch(),
		});
		expect(result.exitCode).toBe(0);
		expect(existsSync(join(cwd, '.claude', 'skills', 'smoke-clean', 'SKILL.md'))).toBe(true);
	});

	it('installs to the current directory when that choice is picked', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-ask-'));
		const choices = installChoices(['claude-code'], 'smoke-clean');
		const result = await runAdd('smoke-clean', {
			cwd,
			promptImpl: async () => String(choices.length),
			fetchImpl: stubFetch(),
		});
		expect(result.exitCode).toBe(0);
		expect(existsSync(join(cwd, 'smoke-clean', 'SKILL.md'))).toBe(true);
	});

	it('streams lines through emit and marks the result streamed', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-emit-'));
		const emitted: string[] = [];
		const result = await runAdd('smoke-clean', {
			cwd,
			dir: join(cwd, 'here'),
			emit: (text) => emitted.push(text),
			fetchImpl: stubFetch(),
		});
		expect(result.streamed).toBe(true);
		expect(emitted.join('\n')).toBe(result.lines.join('\n'));
	});
});

describe('installChoices', () => {
	it('offers declared tools first, then undeclared mapped tools, then current directory', () => {
		const choices = installChoices(['claude-code'], 'smoke-clean');
		expect(choices.map((c) => c.dir)).toEqual([
			join('.claude', 'skills', 'smoke-clean'),
			join(homedir(), '.claude', 'skills', 'smoke-clean'),
			join('.agents', 'skills', 'smoke-clean'),
			'smoke-clean',
		]);
	});

	it('marks undeclared tools honestly', () => {
		const choices = installChoices(['claude-code'], 'smoke-clean');
		const codex = choices.find((c) => c.label.startsWith('codex'));
		expect(codex?.label).toContain('not declared by this skill');
		expect(choices[0].label).not.toContain('not declared');
	});

	it('puts declared codex ahead of undeclared claude-code', () => {
		const choices = installChoices(['codex'], 'smoke-clean');
		expect(choices[0].dir).toBe(join('.agents', 'skills', 'smoke-clean'));
		expect(choices[0].label).not.toContain('not declared');
	});

	it('still offers all mapped tools when nothing is declared as mappable', () => {
		const choices = installChoices(['cursor'], 'smoke-clean');
		expect(choices.every((c) => c.dir === 'smoke-clean' || c.label.includes('not declared'))).toBe(
			true,
		);
		expect(choices.at(-1)).toEqual({
			label: 'current directory (./smoke-clean)',
			dir: 'smoke-clean',
		});
	});
});
