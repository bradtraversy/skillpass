import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PublicSkillSummary } from 'skill-schema';
import { loadPackageFromFiles } from 'validator';
import { describe, expect, it, vi } from 'vitest';
import { runOutdated } from './outdated';
import { recordReceipt } from './receipts';

const temp = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

function summary(slug: string, version: string): PublicSkillSummary {
	return {
		slug,
		name: slug,
		summary: 'x',
		targets: ['claude-code'],
		validationStatus: 'passed',
		riskLevel: 'low',
		version,
		maintainer: 'somedev',
		attributedTo: null,
		featured: false,
		verified: false,
		publishedAt: '2026-07-07T18:24:19.337Z',
	};
}

const RECEIPT = { sourceHash: 'sha256:abc', installedAt: '2026-08-02T12:00:00.000Z' };

function installDir(area: string, name: string) {
	mkdirSync(join(area, name), { recursive: true });
	writeFileSync(join(area, name, 'SKILL.md'), `# ${name}\n`);
}

function listFetch(list: PublicSkillSummary[], extra: Record<string, unknown> = {}) {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		const match = Object.entries(extra).find(([suffix]) => url.endsWith(suffix));
		if (match) {
			return new Response(JSON.stringify({ success: true, data: match[1] }), { status: 200 });
		}
		if (url.endsWith('/skills')) {
			return new Response(JSON.stringify({ success: true, data: list }), { status: 200 });
		}
		return new Response(JSON.stringify({ success: false, error: 'not found' }), { status: 404 });
	}) as unknown as typeof fetch;
}

describe('runOutdated', () => {
	it('reports current and outdated skills per area with exit 1 when updates exist', async () => {
		const cwd = temp('skillpass-outdated-');
		const home = temp('skillpass-outdated-home-');
		const area = join(cwd, '.claude', 'skills');
		installDir(area, 'fresh');
		installDir(area, 'stale');
		recordReceipt(area, 'fresh', { ...RECEIPT, version: '2.0.0' });
		recordReceipt(area, 'stale', { ...RECEIPT, version: '1.0.0' });
		const result = await runOutdated({
			cwd,
			home,
			fetchImpl: listFetch([summary('fresh', '2.0.0'), summary('stale', '1.5.0')]),
		});
		expect(result.exitCode).toBe(1);
		const text = result.lines.join('\n');
		expect(text).toContain('fresh  2.0.0  current');
		expect(text).toContain('stale  1.0.0 -> 1.5.0');
		expect(text).toContain('1 update(s) available');
	});

	it('exits 0 when everything is current', async () => {
		const cwd = temp('skillpass-outdated-');
		const home = temp('skillpass-outdated-home-');
		const area = join(cwd, '.agents', 'skills');
		installDir(area, 'fresh');
		recordReceipt(area, 'fresh', { ...RECEIPT, version: '2.0.0' });
		const result = await runOutdated({ cwd, home, fetchImpl: listFetch([summary('fresh', '2.0.0')]) });
		expect(result.exitCode).toBe(0);
		expect(result.lines.at(-1)).toBe('Everything is current.');
	});

	it('groups pack members into one row', async () => {
		const cwd = temp('skillpass-outdated-');
		const home = temp('skillpass-outdated-home-');
		const area = join(cwd, '.claude', 'skills');
		for (const name of ['adopt', 'audit']) {
			installDir(area, name);
			recordReceipt(area, name, {
				...RECEIPT,
				version: '1.0.0',
				pack: { slug: 'blueprint-pack', version: '1.0.0' },
			});
		}
		const result = await runOutdated({
			cwd,
			home,
			fetchImpl: listFetch([summary('blueprint-pack', '1.1.0')]),
		});
		expect(result.exitCode).toBe(1);
		const text = result.lines.join('\n');
		expect(text).toContain('blueprint-pack  1.0.0 -> 1.1.0  (pack, 2 skills)');
		expect(text).not.toContain('adopt ');
	});

	it('identifies an unreceipted single by hash', async () => {
		const cwd = temp('skillpass-outdated-');
		const home = temp('skillpass-outdated-home-');
		const area = join(cwd, '.claude', 'skills');
		const files = [{ path: 'SKILL.md', content: '# ghost\n' }];
		installDir(area, 'ghost');
		writeFileSync(join(area, 'ghost', 'SKILL.md'), '# ghost\n');
		const hash = loadPackageFromFiles(files).sourceHash;
		const detail = {
			...summary('ghost', '2.0.0'),
			githubRepoUrl: null,
			passport: {
				schemaVersion: '0.1',
				validationStatus: 'passed',
				riskLevel: 'low',
				permissionsSummary: { declared: [], detected: [] },
				warningsSummary: [],
				distribution: 'skill',
				manifestInferred: false,
				sourceHash: hash,
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
		const preflight = (version: string, sourceHash: string) => ({
			version,
			validationStatus: 'passed',
			riskLevel: 'low',
			sourceHash,
			sourceVerified: true,
			resolvedCommitSha: null,
			generatedAt: '2026-07-07T18:24:19.337Z',
			permissions: { declared: [], detected: [] },
			diff: null,
			blocked: false,
			blockedReason: null,
		});
		const result = await runOutdated({
			cwd,
			home,
			fetchImpl: listFetch([summary('ghost', '2.0.0')], {
				'/skills/ghost': detail,
				'/skills/ghost/2.0.0/preflight': preflight('2.0.0', 'sha256:other'),
				'/skills/ghost/1.0.0/preflight': preflight('1.0.0', hash),
			}),
		});
		expect(result.exitCode).toBe(1);
		expect(result.lines.join('\n')).toContain('ghost  1.0.0 -> 2.0.0  (identified by hash)');
	});

	it('notes an unidentifiable install of a listed skill, ignores unrelated folders', async () => {
		const cwd = temp('skillpass-outdated-');
		const home = temp('skillpass-outdated-home-');
		const area = join(cwd, '.claude', 'skills');
		installDir(area, 'mystery');
		installDir(area, 'my-own-thing');
		installDir(area, 'fresh');
		recordReceipt(area, 'fresh', { ...RECEIPT, version: '2.0.0' });
		const result = await runOutdated({
			cwd,
			home,
			fetchImpl: listFetch([summary('fresh', '2.0.0'), summary('mystery', '2.0.0')]),
		});
		expect(result.exitCode).toBe(0);
		const text = result.lines.join('\n');
		expect(text).toContain('mystery  ?  no receipt - reinstall to track updates');
		expect(text).not.toContain('my-own-thing');
		expect(text).toContain('(1 folder(s) not from the directory)');
	});

	it('skips an area holding only unrelated folders', async () => {
		const cwd = temp('skillpass-outdated-');
		const home = temp('skillpass-outdated-home-');
		installDir(join(cwd, '.claude', 'skills'), 'my-own-thing');
		const result = await runOutdated({ cwd, home, fetchImpl: listFetch([]) });
		expect(result.exitCode).toBe(0);
		expect(result.lines).toEqual(['No skills installed in the known install areas.']);
	});

	it('reports nothing installed and exits 0', async () => {
		const result = await runOutdated({
			cwd: temp('skillpass-outdated-'),
			home: temp('skillpass-outdated-home-'),
			fetchImpl: listFetch([]),
		});
		expect(result.exitCode).toBe(0);
		expect(result.lines).toEqual(['No skills installed in the known install areas.']);
	});

	it('errors with exit 2 when the API is unreachable', async () => {
		const down = vi.fn(async () => {
			throw new Error('offline');
		}) as unknown as typeof fetch;
		const result = await runOutdated({
			cwd: temp('skillpass-outdated-'),
			home: temp('skillpass-outdated-home-'),
			fetchImpl: down,
		});
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('cannot reach the API');
	});
});
