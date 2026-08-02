import { strToU8, zipSync } from 'fflate';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PublicPreflight, PublicSkillDetail } from 'skill-schema';
import { loadPackageFromFiles } from 'validator';
import { describe, expect, it, vi } from 'vitest';
import { readReceipts, recordReceipt } from './receipts';
import { permissionChanges, runUpdate } from './update';

const OLD_FILES = [{ path: 'SKILL.md', content: '# demo v1\n' }];
const NEW_FILES = [
	{ path: 'SKILL.md', content: '# demo v2\n' },
	{ path: 'extra.md', content: 'new file\n' },
];
const OLD_HASH = loadPackageFromFiles(OLD_FILES).sourceHash;
const NEW_HASH = loadPackageFromFiles(NEW_FILES).sourceHash;
const NEW_ZIP = zipSync(Object.fromEntries(NEW_FILES.map((f) => [f.path, strToU8(f.content)])));

function detail(version: string): PublicSkillDetail {
	return {
		slug: 'demo',
		name: 'demo',
		summary: 'Demo skill.',
		targets: ['claude-code'],
		validationStatus: 'passed',
		riskLevel: 'low',
		version,
		maintainer: 'somedev',
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
			sourceHash: NEW_HASH,
			engineVersion: 'validator-0.1.0',
			generatedAt: '2026-07-07T18:24:19.337Z',
		},
		maintainerInfo: { username: 'somedev', displayName: 'Some Dev', avatarUrl: 'https://example.com/a.png' },
		versions: [
			{ version: '2.0.0', validationStatus: 'passed', riskLevel: 'low', publishedAt: '2026-07-07T18:24:19.337Z' },
			{ version: '1.0.0', validationStatus: 'passed', riskLevel: 'low', publishedAt: '2026-07-01T18:24:19.337Z' },
		],
		aiReview: null,
	};
}

function preflight(version: string, overrides: Partial<PublicPreflight> = {}): PublicPreflight {
	return {
		version,
		validationStatus: 'passed',
		riskLevel: 'low',
		sourceHash: version === '1.0.0' ? OLD_HASH : NEW_HASH,
		sourceVerified: true,
		resolvedCommitSha: null,
		generatedAt: '2026-07-07T18:24:19.337Z',
		permissions: { declared: [], detected: [] },
		diff: null,
		blocked: false,
		blockedReason: null,
		...overrides,
	};
}

function stubFetch(overrides: Record<string, unknown> = {}) {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		const match = Object.entries(overrides).find(([suffix]) => url.includes(suffix));
		if (match) {
			return new Response(JSON.stringify({ success: true, data: match[1] }), { status: 200 });
		}
		if (url.includes('/download')) {
			return new Response(NEW_ZIP.slice().buffer as ArrayBuffer, { status: 200 });
		}
		if (url.endsWith('/2.0.0/preflight')) {
			return new Response(JSON.stringify({ success: true, data: preflight('2.0.0') }), { status: 200 });
		}
		if (url.endsWith('/1.0.0/preflight')) {
			return new Response(JSON.stringify({ success: true, data: preflight('1.0.0') }), { status: 200 });
		}
		if (url.endsWith('/skills/demo') || url.endsWith('/skills/demo/2.0.0')) {
			return new Response(JSON.stringify({ success: true, data: detail('2.0.0') }), { status: 200 });
		}
		if (url.endsWith('/skills/demo/1.0.0')) {
			return new Response(JSON.stringify({ success: true, data: detail('1.0.0') }), { status: 200 });
		}
		return new Response(JSON.stringify({ success: false, error: 'not found' }), { status: 404 });
	}) as unknown as typeof fetch;
}

function ctx() {
	const cwd = mkdtempSync(join(tmpdir(), 'skillpass-update-'));
	const home = mkdtempSync(join(tmpdir(), 'skillpass-update-home-'));
	const area = join(cwd, '.claude', 'skills');
	const dir = join(area, 'demo');
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'SKILL.md'), '# demo v1\n');
	return { cwd, home, area, dir };
}

const RECEIPT = { sourceHash: OLD_HASH, installedAt: '2026-08-02T12:00:00.000Z' };

describe('permissionChanges', () => {
	it('diffs the union of declared and detected sets', () => {
		const changes = permissionChanges(
			{ declared: ['env.read'], detected: ['network.fetch'] },
			{ declared: ['env.read'], detected: ['shell.execute'] },
		);
		expect(changes).toEqual({ added: ['shell.execute'], removed: ['network.fetch'] });
	});
});

describe('runUpdate', () => {
	it('updates a receipted install, swapping files and the receipt', async () => {
		const { cwd, home, area, dir } = ctx();
		recordReceipt(area, 'demo', { ...RECEIPT, version: '1.0.0' });
		const result = await runUpdate('demo', { cwd, home, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain('Updated demo 1.0.0 -> 2.0.0');
		expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toBe('# demo v2\n');
		expect(readFileSync(join(dir, 'extra.md'), 'utf8')).toBe('new file\n');
		expect(readReceipts(area).demo).toMatchObject({ version: '2.0.0', sourceHash: NEW_HASH });
	});

	it('is a friendly no-op when already current', async () => {
		const { cwd, home, area } = ctx();
		recordReceipt(area, 'demo', { ...RECEIPT, version: '2.0.0' });
		const result = await runUpdate('demo', { cwd, home, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(result.lines).toEqual(['demo is already at 2.0.0.']);
	});

	it('shows the permission diff against the installed version', async () => {
		const { cwd, home, area } = ctx();
		recordReceipt(area, 'demo', { ...RECEIPT, version: '1.0.0' });
		const result = await runUpdate('demo', {
			cwd,
			home,
			fetchImpl: stubFetch({
				'/2.0.0/preflight': preflight('2.0.0', {
					permissions: { declared: [], detected: ['network.fetch'] },
				}),
			}),
		});
		expect(result.exitCode).toBe(0);
		const text = result.lines.join('\n');
		expect(text).toContain('Changes vs installed v1.0.0');
		expect(text).toContain('+ network.fetch (new)');
	});

	it('pins a downgrade with slug@version', async () => {
		const { cwd, home, area, dir } = ctx();
		writeFileSync(join(dir, 'SKILL.md'), '# demo v2\n');
		recordReceipt(area, 'demo', { ...RECEIPT, version: '2.0.0', sourceHash: NEW_HASH });
		const oldZip = zipSync(Object.fromEntries(OLD_FILES.map((f) => [f.path, strToU8(f.content)])));
		const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('/download')) {
				return new Response(oldZip.slice().buffer as ArrayBuffer, { status: 200 });
			}
			if (url.endsWith('/1.0.0/preflight') || url.endsWith('/2.0.0/preflight')) {
				const version = url.includes('/1.0.0/') ? '1.0.0' : '2.0.0';
				return new Response(JSON.stringify({ success: true, data: preflight(version) }), { status: 200 });
			}
			return new Response(JSON.stringify({ success: true, data: detail('1.0.0') }), { status: 200 });
		}) as unknown as typeof fetch;
		const result = await runUpdate('demo@1.0.0', { cwd, home, fetchImpl });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain('Updated demo 2.0.0 -> 1.0.0');
		expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toBe('# demo v1\n');
	});

	it('aborts on declined confirmation, leaving the install untouched', async () => {
		const { cwd, home, area, dir } = ctx();
		recordReceipt(area, 'demo', { ...RECEIPT, version: '1.0.0' });
		const result = await runUpdate('demo', {
			cwd,
			home,
			confirmImpl: async () => false,
			fetchImpl: stubFetch({
				'/2.0.0/preflight': preflight('2.0.0', { riskLevel: 'medium' }),
			}),
		});
		expect(result.exitCode).toBe(2);
		expect(result.lines.join('\n')).toContain('Update aborted');
		expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toBe('# demo v1\n');
		expect(readReceipts(area).demo.version).toBe('1.0.0');
	});

	it('updates an unreceipted install identified by hash and adopts a receipt', async () => {
		const { cwd, home, area, dir } = ctx();
		const result = await runUpdate('demo', { cwd, home, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.join('\n')).toContain('Updated demo 1.0.0 -> 2.0.0');
		expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toBe('# demo v2\n');
		expect(readReceipts(area).demo.version).toBe('2.0.0');
	});

	it('walks a pack update: swaps, adds, and removes members', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-update-'));
		const home = mkdtempSync(join(tmpdir(), 'skillpass-update-home-'));
		const area = join(cwd, '.claude', 'skills');
		for (const name of ['adopt', 'legacy']) {
			mkdirSync(join(area, name), { recursive: true });
			writeFileSync(join(area, name, 'SKILL.md'), `# ${name} v1\n`);
			recordReceipt(area, name, {
				...RECEIPT,
				version: '1.0.0',
				pack: { slug: 'blueprint-pack', version: '1.0.0' },
			});
		}
		const newFiles = [
			{ path: '.claude/skills/adopt/SKILL.md', content: '# adopt v2\n' },
			{ path: '.claude/skills/fresh/SKILL.md', content: '# fresh v2\n' },
		];
		const newHash = loadPackageFromFiles(newFiles).sourceHash;
		const newZip = zipSync(Object.fromEntries(newFiles.map((f) => [f.path, strToU8(f.content)])));
		const packDetail = {
			...detail('2.0.0'),
			slug: 'blueprint-pack',
			name: 'blueprint-pack',
			packSkills: ['adopt', 'fresh'],
			packMembers: [
				{ name: 'adopt', entry: '.claude/skills/adopt/SKILL.md', targets: ['claude-code'] },
				{ name: 'fresh', entry: '.claude/skills/fresh/SKILL.md', targets: ['claude-code'] },
			],
		};
		const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('/download')) {
				return new Response(newZip.slice().buffer as ArrayBuffer, { status: 200 });
			}
			if (url.endsWith('/preflight')) {
				const version = url.includes('/1.0.0/') ? '1.0.0' : '2.0.0';
				return new Response(
					JSON.stringify({
						success: true,
						data: preflight(version, version === '2.0.0' ? { sourceHash: newHash } : {}),
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify({ success: true, data: packDetail }), { status: 200 });
		}) as unknown as typeof fetch;

		const result = await runUpdate('blueprint-pack', { cwd, home, fetchImpl });
		expect(result.exitCode).toBe(0);
		expect(readFileSync(join(area, 'adopt', 'SKILL.md'), 'utf8')).toBe('# adopt v2\n');
		expect(readFileSync(join(area, 'fresh', 'SKILL.md'), 'utf8')).toBe('# fresh v2\n');
		expect(existsSync(join(area, 'legacy'))).toBe(false);
		const receipts = readReceipts(area);
		expect(Object.keys(receipts).sort()).toEqual(['adopt', 'fresh']);
		expect(receipts.adopt.pack).toEqual({ slug: 'blueprint-pack', version: '2.0.0' });
		const text = result.lines.join('\n');
		expect(text).toContain('added: fresh');
		expect(text).toContain('removed: legacy');
	});

	it('directs a pack member to the pack update', async () => {
		const { cwd, home, area } = ctx();
		recordReceipt(area, 'demo', {
			...RECEIPT,
			version: '1.0.0',
			pack: { slug: 'big-pack', version: '1.0.0' },
		});
		const result = await runUpdate('demo', { cwd, home, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('part of the big-pack pack');
	});

	it('errors when the slug is not installed anywhere known', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'skillpass-update-'));
		const home = mkdtempSync(join(tmpdir(), 'skillpass-update-home-'));
		const result = await runUpdate('demo', { cwd, home, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('not installed in a known skills area');
	});

	it('lists locations when installed in several areas', async () => {
		const { cwd, home, area } = ctx();
		recordReceipt(area, 'demo', { ...RECEIPT, version: '1.0.0' });
		const codexArea = join(cwd, '.agents', 'skills');
		mkdirSync(join(codexArea, 'demo'), { recursive: true });
		writeFileSync(join(codexArea, 'demo', 'SKILL.md'), '# demo v1\n');
		recordReceipt(codexArea, 'demo', { ...RECEIPT, version: '1.0.0' });
		const result = await runUpdate('demo', { cwd, home, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('more than one place');
	});
});
