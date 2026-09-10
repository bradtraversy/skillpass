import { strToU8, zipSync } from 'fflate';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { PublicPreflight, PublicSkillDetail } from 'skill-schema';
import { loadPackageFromFiles } from 'validator';
import { describe, expect, it, vi } from 'vitest';
import { installChoices, runAdd, writeTree } from './add';
import { readReceipts } from './receipts';

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

function stubFetch(
	overrides: { detail?: PublicSkillDetail; preflight?: PublicPreflight; zip?: Uint8Array } = {},
) {
	const d = overrides.detail ?? detail;
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
		return new Response(JSON.stringify({ success: true, data: d }), { status: 200 });
	}) as unknown as typeof fetch;
}

const tempTarget = () => join(mkdtempSync(join(tmpdir(), 'skillpass-add-')), 'skill');

const PACK_FILES = [
	{ path: '.agents/skills/adopt/SKILL.md', content: '# adopt codex\n' },
	{ path: '.agents/skills/audit/SKILL.md', content: '# audit codex\n' },
	{ path: '.claude/skills/adopt/SKILL.md', content: '# adopt claude\n' },
	{ path: '.claude/skills/adopt/reference.md', content: 'adopt notes\n' },
	{ path: '.claude/skills/audit/SKILL.md', content: '# audit claude\n' },
	{ path: '.claude/skills/niche/SKILL.md', content: '# niche claude\n' },
	{ path: 'README.md', content: 'pack readme\n' },
];
const PACK_HASH = loadPackageFromFiles(PACK_FILES).sourceHash;
const PACK_ZIP = zipSync(Object.fromEntries(PACK_FILES.map((f) => [f.path, strToU8(f.content)])));

const packDetail: PublicSkillDetail = {
	...detail,
	slug: 'blueprint-pack',
	name: 'blueprint-pack',
	targets: ['claude-code', 'codex'],
	packSkills: ['adopt', 'audit', 'niche'],
	packMembers: [
		{
			name: 'adopt',
			entry: '.claude/skills/adopt/SKILL.md',
			targets: ['claude-code', 'codex'],
			variants: { codex: '.agents/skills/adopt/SKILL.md' },
		},
		{
			name: 'audit',
			entry: '.claude/skills/audit/SKILL.md',
			targets: ['claude-code', 'codex'],
			variants: { codex: '.agents/skills/audit/SKILL.md' },
		},
		{ name: 'niche', entry: '.claude/skills/niche/SKILL.md', targets: ['claude-code'] },
	],
	passport: { ...detail.passport, sourceHash: PACK_HASH },
};
const packPreflight: PublicPreflight = { ...preflight, sourceHash: PACK_HASH };
const packStub = () => stubFetch({ detail: packDetail, preflight: packPreflight, zip: PACK_ZIP });

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

	it('refuses a target that exists as a file instead of crashing', async () => {
		const dir = tempTarget();
		mkdirSync(join(dir, '..'), { recursive: true });
		writeFileSync(dir, 'i am a file');
		const result = await runAdd('smoke-clean', { dir, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('not a directory');
	});

	it('rejects a zip with too many files without installing', async () => {
		const bomb = zipSync(
			Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`f${i}.md`, strToU8('x')])),
		);
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', { dir, fetchImpl: stubFetch({ zip: bomb }) });
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('exceeds the size caps');
		expect(existsSync(dir)).toBe(false);
	});

	it('rejects a zip with an oversized file without installing', async () => {
		const bomb = zipSync({ 'big.md': strToU8('a'.repeat(1024 * 1024 + 1)) });
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', { dir, fetchImpl: stubFetch({ zip: bomb }) });
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('exceeds the size caps');
		expect(existsSync(dir)).toBe(false);
	});

	it('rejects an oversized download body before unzipping', async () => {
		const huge = new Uint8Array(20 * 1024 * 1024 + 1);
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', { dir, fetchImpl: stubFetch({ zip: huge }) });
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('larger than the expected maximum');
		expect(existsSync(dir)).toBe(false);
	});

	it('installs atomically, leaving no temp dir behind', async () => {
		const dir = tempTarget();
		const result = await runAdd('smoke-clean', { dir, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		const parent = join(dir, '..');
		expect(readdirSync(parent)).toEqual(['skill']);
	});

	it('installs into an existing empty target directory', async () => {
		const dir = tempTarget();
		mkdirSync(dir, { recursive: true });
		const result = await runAdd('smoke-clean', { dir, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toBe('# smoke-clean\n');
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
		const receipts = readReceipts(join(cwd, '.claude', 'skills'));
		expect(receipts['smoke-clean']).toMatchObject({ version: '1.0.0', sourceHash: REAL_HASH });
		expect(receipts['smoke-clean'].pack).toBeUndefined();
	});

	it('writes no receipt for a --dir install', async () => {
		const dir = tempTarget();
		await runAdd('smoke-clean', { dir, fetchImpl: stubFetch() });
		expect(readReceipts(join(dir, '..'))).toEqual({});
	});

	it('records pack membership on every fan-out receipt', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-pack-'));
		await runAdd('blueprint-pack', { target: 'codex', cwd, fetchImpl: packStub() });
		const receipts = readReceipts(join(cwd, '.agents', 'skills'));
		expect(Object.keys(receipts).sort()).toEqual(['adopt', 'audit']);
		expect(receipts.adopt.pack).toEqual({ slug: 'blueprint-pack', version: '1.0.0' });
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

	it('rejects --global without --target before touching the network', async () => {
		const fetchImpl = stubFetch();
		const result = await runAdd('smoke-clean', { global: true, fetchImpl });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('--global needs --target');
		expect(fetchImpl).not.toHaveBeenCalled();
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

	it('re-prompts on an invalid picker answer instead of defaulting', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-ask-'));
		const choices = installChoices(['claude-code'], 'smoke-clean');
		const answers = ['99', 'abc', String(choices.length)];
		const promptImpl = vi.fn(async () => answers.shift() ?? '');
		const result = await runAdd('smoke-clean', { cwd, promptImpl, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(promptImpl).toHaveBeenCalledTimes(3);
		expect(result.lines.join('\n')).toContain(`answer 1-${choices.length}`);
		expect(existsSync(join(cwd, 'smoke-clean', 'SKILL.md'))).toBe(true);
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

	it('installs every pack member into the claude-code area', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-pack-'));
		const result = await runAdd('blueprint-pack', {
			target: 'claude-code',
			cwd,
			fetchImpl: packStub(),
		});
		expect(result.exitCode).toBe(0);
		expect(readFileSync(join(cwd, '.claude', 'skills', 'adopt', 'SKILL.md'), 'utf8')).toBe(
			'# adopt claude\n',
		);
		expect(readFileSync(join(cwd, '.claude', 'skills', 'adopt', 'reference.md'), 'utf8')).toBe(
			'adopt notes\n',
		);
		expect(readFileSync(join(cwd, '.claude', 'skills', 'niche', 'SKILL.md'), 'utf8')).toBe(
			'# niche claude\n',
		);
		expect(existsSync(join(cwd, '.claude', 'skills', 'README.md'))).toBe(false);
		expect(result.lines.join('\n')).toContain('Installed 3 skills to');
	});

	it('uses codex variants and skips unsupported members visibly', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-pack-'));
		const result = await runAdd('blueprint-pack', { target: 'codex', cwd, fetchImpl: packStub() });
		expect(result.exitCode).toBe(0);
		expect(readFileSync(join(cwd, '.agents', 'skills', 'adopt', 'SKILL.md'), 'utf8')).toBe(
			'# adopt codex\n',
		);
		expect(existsSync(join(cwd, '.agents', 'skills', 'niche'))).toBe(false);
		const text = result.lines.join('\n');
		expect(text).toContain('note: niche does not support codex; skipped');
		expect(text).toContain('Installed 2 skills to');
	});

	it('receipts each pack member as it lands, so a later failure loses none of them', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-pack-'));
		const area = join(cwd, '.claude', 'skills');
		// writeTree stages into `<dest>.tmp-<pid>`; a file squatting there makes the third member fail.
		mkdirSync(area, { recursive: true });
		writeFileSync(join(area, `niche.tmp-${process.pid}`), '');
		const result = await runAdd('blueprint-pack', { target: 'claude-code', cwd, fetchImpl: packStub() });
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('installed before the failure: adopt, audit');
		const receipts = readReceipts(area);
		expect(Object.keys(receipts).sort()).toEqual(['adopt', 'audit']);
		expect(receipts.adopt?.pack?.slug).toBe('blueprint-pack');
	});

	it('aborts the whole pack when any member destination is occupied', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-pack-'));
		const audit = join(cwd, '.claude', 'skills', 'audit');
		mkdirSync(audit, { recursive: true });
		writeFileSync(join(audit, 'keep.md'), 'mine');
		const result = await runAdd('blueprint-pack', {
			target: 'claude-code',
			cwd,
			fetchImpl: packStub(),
		});
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('nothing was installed');
		expect(existsSync(join(cwd, '.claude', 'skills', 'adopt'))).toBe(false);
		expect(readFileSync(join(audit, 'keep.md'), 'utf8')).toBe('mine');
	});

	it('keeps the raw snapshot with --dir on a pack, with a note', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-pack-'));
		const dir = join(cwd, 'raw');
		const result = await runAdd('blueprint-pack', { dir, cwd, fetchImpl: packStub() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain('raw pack source');
		expect(readFileSync(join(dir, 'README.md'), 'utf8')).toBe('pack readme\n');
		expect(readFileSync(join(dir, '.agents', 'skills', 'adopt', 'SKILL.md'), 'utf8')).toBe(
			'# adopt codex\n',
		);
	});

	it('fans out from the interactive pack picker', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-pack-'));
		const promptImpl = vi.fn(async () => '1');
		const result = await runAdd('blueprint-pack', { cwd, promptImpl, fetchImpl: packStub() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain('3 skills');
		expect(existsSync(join(cwd, '.claude', 'skills', 'adopt', 'SKILL.md'))).toBe(true);
		expect(existsSync(join(cwd, 'blueprint-pack'))).toBe(false);
	});

	it('defaults to the raw snapshot without a terminal, tipping the fan-out', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-pack-'));
		const result = await runAdd('blueprint-pack', { cwd, fetchImpl: packStub() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain(
			"tip: --target claude-code installs the 3 skills into the tool's skills folder",
		);
		expect(readFileSync(join(cwd, 'blueprint-pack', 'README.md'), 'utf8')).toBe('pack readme\n');
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

describe('writeTree', () => {
	it('leaves nothing behind when the staging write fails', () => {
		const dir = mkdtempSync(join(tmpdir(), 'skillpass-writetree-'));
		const target = join(dir, 'skill');
		writeFileSync(`${target}.tmp-${process.pid}`, '');
		expect(() => writeTree([{ path: 'SKILL.md', content: '# x\n' }], target)).toThrow();
		expect(existsSync(target)).toBe(false);
		expect(readdirSync(dir)).toEqual([]);
	});
});
