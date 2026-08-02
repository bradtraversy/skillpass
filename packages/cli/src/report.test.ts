import {
	publicPreflightSchema,
	type PublicPreflight,
	type PublicSkillDetail,
} from 'skill-schema';
import { describe, expect, it, vi } from 'vitest';
import { parseSkillRef } from './api';
import { runReport } from './report';

const detail: PublicSkillDetail = {
	slug: 'smoke-clean',
	name: 'smoke-clean',
	summary: 'Clean smoke-test skill.',
	targets: ['claude-code'],
	validationStatus: 'passed',
	riskLevel: 'low',
	version: '2.0.0',
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
		permissionsSummary: { declared: [], detected: ['network.fetch'] },
		warningsSummary: [],
		distribution: 'skill',
		manifestInferred: false,
		sourceHash: 'sha256:abc',
		engineVersion: 'validator-0.1.0',
		generatedAt: '2026-07-07T18:24:19.337Z',
	},
	maintainerInfo: {
		username: 'bradtraversy',
		displayName: 'Brad Traversy',
		avatarUrl: 'https://example.com/a.png',
	},
	versions: [
		{ version: '2.0.0', validationStatus: 'passed', riskLevel: 'low', publishedAt: '2026-07-07T18:24:19.337Z' },
	],
	aiReview: null,
};

const preflight: PublicPreflight = {
	version: '2.0.0',
	validationStatus: 'passed',
	riskLevel: 'low',
	sourceHash: 'sha256:abc',
	sourceVerified: true,
	resolvedCommitSha: null,
	generatedAt: '2026-07-07T18:24:19.337Z',
	permissions: { declared: [], detected: ['network.fetch'] },
	diff: {
		previousVersion: '1.0.0',
		declared: { added: [], removed: [] },
		detected: { added: ['network.fetch'], removed: [] },
	},
	blocked: false,
	blockedReason: null,
};

function stubFetch(routes: Record<string, { status?: number; body: unknown }>) {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		const match = Object.entries(routes).find(([suffix]) => url.endsWith(suffix));
		if (!match) {
			return new Response(JSON.stringify({ success: false, error: 'not found' }), { status: 404 });
		}
		const { status = 200, body } = match[1];
		return new Response(JSON.stringify(body), { status });
	}) as unknown as typeof fetch;
}

const happyRoutes = {
	'/skills/smoke-clean': { body: { success: true, data: detail } },
	'/skills/smoke-clean/2.0.0': { body: { success: true, data: detail } },
	'/skills/smoke-clean/2.0.0/preflight': { body: { success: true, data: preflight } },
};

describe('parseSkillRef', () => {
	it('splits slug and version on @', () => {
		expect(parseSkillRef('smoke-clean@2.0.0')).toEqual({ slug: 'smoke-clean', version: '2.0.0' });
	});

	it('returns just the slug without @', () => {
		expect(parseSkillRef('smoke-clean')).toEqual({ slug: 'smoke-clean' });
	});
});

describe('runReport', () => {
	it('renders the passport pre-flight readably', async () => {
		const result = await runReport('smoke-clean', { fetchImpl: stubFetch(happyRoutes) });
		expect(result.exitCode).toBe(0);
		const text = result.lines.join('\n');
		expect(text).toContain('Skill     smoke-clean by bradtraversy');
		expect(text).toContain('Status    PASSED');
		expect(text).toContain('(verified)');
		expect(text).toContain('network.fetch - Fetch from the network');
		expect(text).toContain('Changes since v1.0.0');
		expect(text).toContain('+ network.fetch (new)');
	});

	it('colors status, risk, and the verified marker with a styler', async () => {
		const { ANSI } = await import('./style');
		const result = await runReport('smoke-clean', {
			style: ANSI,
			fetchImpl: stubFetch(happyRoutes),
		});
		const text = result.lines.join('\n');
		expect(text).toContain('\x1b[32mPASSED\x1b[39m');
		expect(text).toContain('\x1b[32mlow\x1b[39m');
		expect(text).toContain('\x1b[32m(verified)\x1b[39m');
	});

	it('lists pack members on a pack report and stays silent for singles', async () => {
		const single = await runReport('smoke-clean', { fetchImpl: stubFetch(happyRoutes) });
		expect(single.lines.join('\n')).not.toContain('Pack');

		const packDetail = {
			...detail,
			packSkills: ['adopt', 'audit'],
			packMembers: [
				{ name: 'adopt', entry: '.claude/skills/adopt/SKILL.md' },
				{ name: 'audit', entry: '.claude/skills/audit/SKILL.md' },
			],
		};
		const result = await runReport('smoke-clean', {
			fetchImpl: stubFetch({
				...happyRoutes,
				'/skills/smoke-clean': { body: { success: true, data: packDetail } },
			}),
		});
		expect(result.lines.join('\n')).toContain('Pack      2 skills: adopt, audit');
	});

	it('emits schema-valid PublicPreflight with --json', async () => {
		const result = await runReport('smoke-clean', {
			json: true,
			fetchImpl: stubFetch(happyRoutes),
		});
		expect(result.exitCode).toBe(0);
		expect(publicPreflightSchema.parse(JSON.parse(result.lines.join('\n')))).toEqual(preflight);
	});

	it('pins the requested version with slug@version', async () => {
		const fetchImpl = stubFetch(happyRoutes);
		await runReport('smoke-clean@2.0.0', { fetchImpl });
		const urls = vi.mocked(fetchImpl).mock.calls.map((c) => String(c[0]));
		expect(urls[0]).toContain('/skills/smoke-clean/2.0.0');
		expect(urls[1]).toContain('/skills/smoke-clean/2.0.0/preflight');
	});

	it('exits 2 with a friendly message for an unpublished skill', async () => {
		const result = await runReport('nope', { fetchImpl: stubFetch({}) });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('not published');
	});

	it('exits 1 and prints the reason for a blocked version', async () => {
		const blocked = {
			...preflight,
			validationStatus: 'failed',
			blocked: true,
			blockedReason: 'this version failed validation and cannot be downloaded',
		};
		const result = await runReport('smoke-clean', {
			fetchImpl: stubFetch({
				...happyRoutes,
				'/skills/smoke-clean/2.0.0/preflight': { body: { success: true, data: blocked } },
			}),
		});
		expect(result.exitCode).toBe(1);
		expect(result.lines.join('\n')).toContain('BLOCKED: this version failed validation');
	});

	it('exits 2 when the API is unreachable', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error('ECONNREFUSED');
		}) as unknown as typeof fetch;
		const result = await runReport('smoke-clean', { fetchImpl });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('cannot reach the API');
	});

	it('exits 2 when the response does not match the contract', async () => {
		const result = await runReport('smoke-clean', {
			fetchImpl: stubFetch({
				'/skills/smoke-clean': { body: { success: true, data: { nonsense: true } } },
			}),
		});
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('did not match the expected contract');
	});

	it('rejects an empty version after @', async () => {
		const result = await runReport('smoke-clean@', { fetchImpl: stubFetch(happyRoutes) });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('invalid skill reference');
	});
});
