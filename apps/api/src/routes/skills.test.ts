import { strFromU8, unzipSync } from 'fflate';
import { Hono } from 'hono';
import { setSignedCookie } from 'hono/cookie';
import {
	publicAbuseReportSchema,
	publicPreflightSchema,
	publicSkillDetailSchema,
	publicSkillSourceSchema,
	publicSkillSummarySchema,
	type SkillEntry,
} from 'skill-schema';
import { loadPackageFromFiles } from 'validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { SESSION_COOKIE } from '../auth/middleware';
import { createAbuseReport, findOpenReportBySkillAndReporter } from '../db/abuse';
import { recordDownload } from '../db/downloads';
import { findAiReviewByHash } from '../db/reviews';
import { findById } from '../db/users';
import { BLOCKED_REASON } from './skills';
import type { Db } from '../db/client';
import type { SkillPassportRow, SkillRow, SkillVersionRow, UserRow } from '../db/schema';
import {
	findPublishedSkillBySlug,
	findSkillBySlug,
	findVersionWithPassport,
	listPublishedSkills,
	listVersionsWithPassports,
	setSkillStatus,
	type PublishedSkillRecord,
} from '../db/skills';
import { loadEnv } from '../env';
import type { ValidationQueue } from '../queue/queue';
import { getSnapshotDocument } from '../storage/r2';
import { RAW_TEST_ENV } from '../testing/env';

vi.mock('../db/skills', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/skills')>()),
	listPublishedSkills: vi.fn(),
	findPublishedSkillBySlug: vi.fn(),
	findSkillBySlug: vi.fn(),
	findVersionWithPassport: vi.fn(),
	listVersionsWithPassports: vi.fn(),
	setSkillStatus: vi.fn(),
}));
vi.mock('../storage/r2', async (importOriginal) => ({
	...(await importOriginal<typeof import('../storage/r2')>()),
	getSnapshotDocument: vi.fn(),
}));
vi.mock('../db/reviews', () => ({ findAiReviewByHash: vi.fn() }));
vi.mock('../db/downloads', () => ({ recordDownload: vi.fn() }));
vi.mock('../db/abuse', () => ({
	createAbuseReport: vi.fn(),
	findOpenReportBySkillAndReporter: vi.fn(),
}));
vi.mock('../db/users', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/users')>()),
	findById: vi.fn(),
}));

const env = loadEnv(RAW_TEST_ENV);
const app = createApp(env, {} as Db, {} as ValidationQueue);

const NOW = new Date('2026-07-07T18:24:19.337Z');

const maintainer: UserRow = {
	id: 1,
	githubId: '12345',
	username: 'bradtraversy',
	displayName: 'Brad Traversy',
	avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
	role: 'admin',
	reputation: 0,
	createdAt: new Date('2026-07-04T10:00:00Z'),
};

const skill: SkillRow = {
	id: 1,
	slug: 'smoke-clean',
	name: 'smoke-clean',
	summary: 'Clean smoke-test skill for the 6a worker.',
	maintainerId: 1,
	attributedTo: null,
	category: null,
	displayName: null,
	tagline: null,
	integrations: null,
	status: 'published',
	featured: false,
	verified: false,
	latestVersionId: 1,
	createdAt: NOW,
	updatedAt: NOW,
};

const version: SkillVersionRow = {
	id: 1,
	skillId: 1,
	version: '1.0.0',
	sourceType: 'zip',
	githubRepoUrl: null,
	resolvedCommitSha: null,
	sourceHash: 'sha256:abc',
	snapshotKey: 'snapshots/abc.json',
	targets: ['claude-code'],
	packSkills: null,
	submissionId: 18,
	publishedAt: NOW,
	createdAt: NOW,
};

const passport: SkillPassportRow = {
	id: 1,
	skillVersionId: 1,
	passport: {
		schemaVersion: '0.1',
		validationStatus: 'passed',
		riskLevel: 'low',
		permissionsSummary: { declared: [], detected: [] },
		warningsSummary: [],
		distribution: 'skill',
		manifestInferred: false,
		sourceHash: 'sha256:abc',
		engineVersion: 'validator-0.1.0',
		generatedAt: NOW.toISOString(),
	},
	validationStatus: 'passed',
	riskLevel: 'low',
	generatedAt: NOW,
};

const record: PublishedSkillRecord = { skill, version, passport, maintainer };

async function sessionCookie(id: number): Promise<string> {
	const signer = new Hono();
	signer.get('/', async (c) => {
		await setSignedCookie(c, SESSION_COOKIE, String(id), env.SESSION_SECRET);
		return c.text('ok');
	});
	const res = await signer.request('/');
	return res.headers.getSetCookie()[0].split(';')[0];
}

beforeEach(() => vi.clearAllMocks());

describe('GET /skills', () => {
	it('returns an empty list when nothing is published', async () => {
		vi.mocked(listPublishedSkills).mockResolvedValue([]);
		const res = await app.request('/skills');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true, data: [] });
	});

	it('returns summaries that parse with the locked contract, with no session', async () => {
		vi.mocked(listPublishedSkills).mockResolvedValue([record]);
		const res = await app.request('/skills');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { success: boolean; data: unknown[] };
		expect(body.success).toBe(true);
		expect(publicSkillSummarySchema.parse(body.data[0])).toEqual({
			slug: 'smoke-clean',
			name: 'smoke-clean',
			summary: 'Clean smoke-test skill for the 6a worker.',
			targets: ['claude-code'],
			validationStatus: 'passed',
			riskLevel: 'low',
			noteCount: 0,
			category: null,
			displayName: null,
			tagline: null,
			integrations: null,
			packSkills: null,
			version: '1.0.0',
			maintainer: 'bradtraversy',
			attributedTo: null,
			featured: false,
			verified: false,
			publishedAt: NOW.toISOString(),
		});
	});

	it('exposes pack member names on the summary and full entries on the detail', async () => {
		const members: SkillEntry[] = [
			{
				name: 'plan',
				description: 'Plan things.',
				entry: '.claude/skills/plan/SKILL.md',
				targets: ['claude-code', 'codex'],
				variants: { codex: '.agents/skills/plan/SKILL.md' },
			},
			{ name: 'apply', entry: '.claude/skills/apply/SKILL.md', targets: ['claude-code'] },
		];
		const packVersion = { ...version, packSkills: members };
		const packRecord: PublishedSkillRecord = { ...record, version: packVersion };

		vi.mocked(listPublishedSkills).mockResolvedValue([packRecord]);
		const list = await app.request('/skills');
		const listBody = (await list.json()) as { data: { packSkills: unknown }[] };
		expect(listBody.data[0].packSkills).toEqual(['plan', 'apply']);

		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(packRecord);
		vi.mocked(listVersionsWithPassports).mockResolvedValue([{ version: packVersion, passport }]);
		const detail = await app.request('/skills/smoke-clean');
		const detailBody = (await detail.json()) as { data: unknown };
		expect(publicSkillDetailSchema.parse(detailBody.data).packMembers).toEqual(members);
	});

	it('reports noteCount from the passport advisory findings', async () => {
		const warned: PublishedSkillRecord = {
			...record,
			passport: {
				...passport,
				validationStatus: 'warning',
				passport: {
					...passport.passport,
					validationStatus: 'warning',
					warningsSummary: [
						{ code: 'dangerous-command', message: 'pipes a downloaded script into a shell' },
						{ code: 'credential-harvesting', message: 'searches the machine for secrets' },
					],
				},
			},
		};
		vi.mocked(listPublishedSkills).mockResolvedValue([warned]);
		const res = await app.request('/skills');
		const body = (await res.json()) as { data: { noteCount: number }[] };
		expect(body.data[0].noteCount).toBe(2);
	});

	it('passes featured and verified through from the skill row', async () => {
		vi.mocked(listPublishedSkills).mockResolvedValue([
			{ ...record, skill: { ...skill, featured: true, verified: true } },
		]);
		const res = await app.request('/skills');
		const body = (await res.json()) as { data: { featured: boolean; verified: boolean }[] };
		expect(body.data[0].featured).toBe(true);
		expect(body.data[0].verified).toBe(true);
	});

	it('passes category through from the skill row', async () => {
		vi.mocked(listPublishedSkills).mockResolvedValue([
			{ ...record, skill: { ...skill, category: 'security-review' } },
		]);
		const res = await app.request('/skills');
		const body = (await res.json()) as { data: { category: string | null }[] };
		expect(body.data[0].category).toBe('security-review');
	});

	it('passes integrations through from the skill row', async () => {
		vi.mocked(listPublishedSkills).mockResolvedValue([
			{ ...record, skill: { ...skill, integrations: ['obsidian', 'github'] } },
		]);
		const res = await app.request('/skills');
		const body = (await res.json()) as { data: { integrations: string[] | null }[] };
		expect(body.data[0].integrations).toEqual(['obsidian', 'github']);
	});

	it('passes display copy through from the skill row', async () => {
		vi.mocked(listPublishedSkills).mockResolvedValue([
			{
				...record,
				skill: { ...skill, displayName: 'Smoke Clean', tagline: 'Scrubs smoke-test residue.' },
			},
		]);
		const res = await app.request('/skills');
		const body = (await res.json()) as { data: { displayName: string; tagline: string }[] };
		expect(body.data[0].displayName).toBe('Smoke Clean');
		expect(body.data[0].tagline).toBe('Scrubs smoke-test residue.');
	});

	it('leaks no internal fields', async () => {
		vi.mocked(listPublishedSkills).mockResolvedValue([record]);
		const res = await app.request('/skills');
		const text = JSON.stringify(await res.json());
		expect(text).not.toContain('snapshotKey');
		expect(text).not.toContain('githubId');
		expect(text).not.toContain('maintainerId');
		expect(text).not.toContain('submissionId');
	});
});

describe('GET /skills/:slug', () => {
	it('404s an unknown or unpublished slug', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(undefined);
		const res = await app.request('/skills/nope');
		expect(res.status).toBe(404);
		expect(vi.mocked(listVersionsWithPassports)).not.toHaveBeenCalled();
	});

	it('returns a detail that parses with the locked contract, passport verbatim', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(listVersionsWithPassports).mockResolvedValue([{ version, passport }]);
		const res = await app.request('/skills/smoke-clean');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		const detail = publicSkillDetailSchema.parse(body.data);
		expect(detail.githubRepoUrl).toBeNull();
		expect(detail.passport).toEqual(passport.passport);
		expect(detail.maintainerInfo).toEqual({
			username: 'bradtraversy',
			displayName: 'Brad Traversy',
			avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
		});
		expect(detail.versions).toEqual([
			{
				version: '1.0.0',
				validationStatus: 'passed',
				riskLevel: 'low',
				publishedAt: NOW.toISOString(),
			},
		]);
		expect(detail.aiReview).toBeNull();
	});

	it('includes the cached AI review when one exists for the version source hash', async () => {
		const aiReview = {
			summary: 'Formats markdown tables.',
			verdict: 'clear' as const,
			reasoning: 'Read-only, project-scoped, cosmetic changes.',
			model: 'claude-haiku-4-5',
			reviewedAt: NOW.toISOString(),
		};
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(listVersionsWithPassports).mockResolvedValue([{ version, passport }]);
		vi.mocked(findAiReviewByHash).mockResolvedValue({
			id: 1,
			sourceHash: version.sourceHash,
			review: aiReview,
			createdAt: NOW,
		});
		const res = await app.request('/skills/smoke-clean');
		const body = (await res.json()) as { data: unknown };
		expect(findAiReviewByHash).toHaveBeenCalledWith(expect.anything(), version.sourceHash);
		expect(publicSkillDetailSchema.parse(body.data).aiReview).toEqual(aiReview);
	});

	it('leaks no internal fields on the detail', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(listVersionsWithPassports).mockResolvedValue([{ version, passport }]);
		const res = await app.request('/skills/smoke-clean');
		const text = JSON.stringify(await res.json());
		expect(text).not.toContain('snapshotKey');
		expect(text).not.toContain('githubId');
		expect(text).not.toContain('submissionId');
	});
});

describe('GET /skills/:slug/:version', () => {
	it('404s an unknown version of a known skill', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue(undefined);
		const res = await app.request('/skills/smoke-clean/9.9.9');
		expect(res.status).toBe(404);
	});

	it('returns the detail pinned to the requested version', async () => {
		const oldVersion: SkillVersionRow = { ...version, id: 2, version: '2.0.0' };
		const oldPassport: SkillPassportRow = {
			...passport,
			id: 2,
			skillVersionId: 2,
			validationStatus: 'warning',
			riskLevel: 'medium',
		};
		// The skill's latest is 1.0.0 (record); we request the pinned 2.0.0.
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue({
			version: oldVersion,
			passport: oldPassport,
		});
		vi.mocked(listVersionsWithPassports).mockResolvedValue([
			{ version: oldVersion, passport: oldPassport },
			{ version, passport },
		]);
		const res = await app.request('/skills/smoke-clean/2.0.0');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		const detail = publicSkillDetailSchema.parse(body.data);
		expect(detail.version).toBe('2.0.0');
		expect(detail.validationStatus).toBe('warning');
		expect(detail.riskLevel).toBe('medium');
		expect(detail.versions).toHaveLength(2);
		expect(vi.mocked(findVersionWithPassport)).toHaveBeenCalledWith(
			expect.anything(),
			1,
			'2.0.0',
		);
	});
});

describe('GET /skills/:slug/:version/source', () => {
	const FILES = [
		{ path: 'skill.json', content: '{"name":"smoke-clean"}' },
		{ path: 'SKILL.md', content: '# smoke-clean\n' },
	];

	it('404s before touching R2 when the skill or version is unknown', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(undefined);
		const res = await app.request('/skills/nope/1.0.0/source');
		expect(res.status).toBe(404);
		expect(vi.mocked(getSnapshotDocument)).not.toHaveBeenCalled();
	});

	it('returns the pinned snapshot files with the source hash', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue({ version, passport });
		vi.mocked(getSnapshotDocument).mockResolvedValue({
			success: true,
			data: { version: 1, files: FILES },
		});
		const res = await app.request('/skills/smoke-clean/1.0.0/source');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		expect(publicSkillSourceSchema.parse(body.data)).toEqual({
			version: '1.0.0',
			sourceHash: 'sha256:abc',
			files: FILES,
		});
		expect(vi.mocked(getSnapshotDocument)).toHaveBeenCalledWith(
			expect.anything(),
			'snapshots/abc.json',
		);
	});

	it('502s when R2 is down', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue({ version, passport });
		vi.mocked(getSnapshotDocument).mockResolvedValue({
			success: false,
			error: 'r2 get failed (500)',
		});
		const res = await app.request('/skills/smoke-clean/1.0.0/source');
		expect(res.status).toBe(502);
	});

	it('leaks no snapshot key on the source payload', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue({ version, passport });
		vi.mocked(getSnapshotDocument).mockResolvedValue({
			success: true,
			data: { version: 1, files: FILES },
		});
		const res = await app.request('/skills/smoke-clean/1.0.0/source');
		const text = JSON.stringify(await res.json());
		expect(text).not.toContain('snapshotKey');
		expect(text).not.toContain('snapshots/abc.json');
	});
});

describe('GET /skills/:slug/:version/preflight', () => {
	const FILES = [
		{ path: 'SKILL.md', content: '# smoke-clean\n' },
		{ path: 'skill.json', content: '{"name":"smoke-clean"}' },
	];
	// The real validator hash of FILES, so sourceVerified exercises hash parity.
	const REAL_HASH = loadPackageFromFiles(FILES).sourceHash;

	const currentVersion: SkillVersionRow = {
		...version,
		id: 2,
		version: '2.0.0',
		sourceHash: REAL_HASH,
	};
	const currentPassport: SkillPassportRow = {
		...passport,
		id: 2,
		skillVersionId: 2,
		passport: {
			...passport.passport,
			sourceHash: REAL_HASH,
			permissionsSummary: {
				declared: ['network.fetch'],
				detected: ['network.fetch', 'shell.execute'],
			},
		},
	};
	const previousPassport: SkillPassportRow = {
		...passport,
		passport: {
			...passport.passport,
			permissionsSummary: { declared: ['network.fetch', 'env.read'], detected: ['network.fetch'] },
		},
	};

	function mockPinned(pinned: { version: SkillVersionRow; passport: SkillPassportRow }) {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue(pinned);
		vi.mocked(getSnapshotDocument).mockResolvedValue({
			success: true,
			data: { version: 1, files: FILES },
		});
	}

	it('404s an unknown skill before touching R2', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(undefined);
		const res = await app.request('/skills/nope/1.0.0/preflight');
		expect(res.status).toBe(404);
		expect(vi.mocked(getSnapshotDocument)).not.toHaveBeenCalled();
	});

	it('404s an unknown version of a known skill', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue(undefined);
		const res = await app.request('/skills/smoke-clean/9.9.9/preflight');
		expect(res.status).toBe(404);
	});

	it('returns a verified preflight with the diff against the previous version', async () => {
		mockPinned({ version: currentVersion, passport: currentPassport });
		vi.mocked(listVersionsWithPassports).mockResolvedValue([
			{ version: currentVersion, passport: currentPassport },
			{ version, passport: previousPassport },
		]);
		const res = await app.request('/skills/smoke-clean/2.0.0/preflight');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		expect(publicPreflightSchema.parse(body.data)).toEqual({
			version: '2.0.0',
			validationStatus: 'passed',
			riskLevel: 'low',
			sourceHash: REAL_HASH,
			sourceVerified: true,
			resolvedCommitSha: null,
			generatedAt: NOW.toISOString(),
			permissions: {
				declared: ['network.fetch'],
				detected: ['network.fetch', 'shell.execute'],
			},
			diff: {
				previousVersion: '1.0.0',
				declared: { added: [], removed: ['env.read'] },
				detected: { added: ['shell.execute'], removed: [] },
			},
			blocked: false,
			blockedReason: null,
		});
	});

	it('returns a null diff for the first published version', async () => {
		mockPinned({ version: currentVersion, passport: currentPassport });
		vi.mocked(listVersionsWithPassports).mockResolvedValue([
			{ version: currentVersion, passport: currentPassport },
		]);
		const res = await app.request('/skills/smoke-clean/2.0.0/preflight');
		const body = (await res.json()) as { data: unknown };
		expect(publicPreflightSchema.parse(body.data).diff).toBeNull();
	});

	it('reports sourceVerified false when the snapshot does not match the pinned hash', async () => {
		const tampered: SkillVersionRow = { ...currentVersion, sourceHash: 'sha256:pinned-other' };
		mockPinned({ version: tampered, passport: currentPassport });
		vi.mocked(listVersionsWithPassports).mockResolvedValue([
			{ version: tampered, passport: currentPassport },
		]);
		const res = await app.request('/skills/smoke-clean/2.0.0/preflight');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		expect(publicPreflightSchema.parse(body.data).sourceVerified).toBe(false);
	});

	it('marks a failed version blocked with a reason', async () => {
		const failedPassport: SkillPassportRow = {
			...currentPassport,
			validationStatus: 'failed',
			riskLevel: 'critical',
			passport: { ...currentPassport.passport, validationStatus: 'failed', riskLevel: 'critical' },
		};
		mockPinned({ version: currentVersion, passport: failedPassport });
		vi.mocked(listVersionsWithPassports).mockResolvedValue([
			{ version: currentVersion, passport: failedPassport },
		]);
		const res = await app.request('/skills/smoke-clean/2.0.0/preflight');
		const body = (await res.json()) as { data: unknown };
		const preflight = publicPreflightSchema.parse(body.data);
		expect(preflight.blocked).toBe(true);
		expect(preflight.blockedReason).toBe(BLOCKED_REASON);
	});

	it('502s when R2 is down', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue({ version, passport });
		vi.mocked(getSnapshotDocument).mockResolvedValue({
			success: false,
			error: 'r2 get failed (500)',
		});
		const res = await app.request('/skills/smoke-clean/1.0.0/preflight');
		expect(res.status).toBe(502);
	});

	it('leaks no internal fields', async () => {
		mockPinned({ version: currentVersion, passport: currentPassport });
		vi.mocked(listVersionsWithPassports).mockResolvedValue([
			{ version: currentVersion, passport: currentPassport },
		]);
		const res = await app.request('/skills/smoke-clean/2.0.0/preflight');
		const text = JSON.stringify(await res.json());
		expect(text).not.toContain('snapshotKey');
		expect(text).not.toContain('githubId');
		expect(text).not.toContain('submissionId');
		expect(text).not.toContain('snapshots/');
	});
});

describe('GET /skills/:slug/:version/download', () => {
	const FILES = [
		{ path: 'SKILL.md', content: '# smoke-clean\n' },
		{ path: 'skill.json', content: '{"name":"smoke-clean"}' },
	];
	const REAL_HASH = loadPackageFromFiles(FILES).sourceHash;

	const verifiedVersion: SkillVersionRow = { ...version, sourceHash: REAL_HASH };
	const verifiedPassport: SkillPassportRow = {
		...passport,
		passport: { ...passport.passport, sourceHash: REAL_HASH },
	};

	function mockVerified() {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue({
			version: verifiedVersion,
			passport: verifiedPassport,
		});
		vi.mocked(getSnapshotDocument).mockResolvedValue({
			success: true,
			data: { version: 1, files: FILES },
		});
	}

	it('404s an unknown skill or version', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(undefined);
		expect((await app.request('/skills/nope/1.0.0/download')).status).toBe(404);
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue(undefined);
		expect((await app.request('/skills/smoke-clean/9.9.9/download')).status).toBe(404);
		expect(vi.mocked(recordDownload)).not.toHaveBeenCalled();
	});

	it('serves a zip that round-trips to the snapshot files, with attachment headers', async () => {
		mockVerified();
		const res = await app.request('/skills/smoke-clean/1.0.0/download');
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/zip');
		expect(res.headers.get('Content-Disposition')).toBe(
			'attachment; filename="smoke-clean-1.0.0.zip"',
		);
		const unzipped = unzipSync(new Uint8Array(await res.arrayBuffer()));
		expect(Object.keys(unzipped).sort()).toEqual(['SKILL.md', 'skill.json']);
		expect(strFromU8(unzipped['SKILL.md'])).toBe('# smoke-clean\n');
		expect(strFromU8(unzipped['skill.json'])).toBe('{"name":"smoke-clean"}');
	});

	it('records an anonymous web download event', async () => {
		mockVerified();
		await app.request('/skills/smoke-clean/1.0.0/download');
		expect(vi.mocked(recordDownload)).toHaveBeenCalledWith(expect.anything(), {
			skillVersionId: 1,
			userId: null,
			source: 'web',
		});
	});

	it('records a cli download event when ?source=cli', async () => {
		mockVerified();
		const res = await app.request('/skills/smoke-clean/1.0.0/download?source=cli');
		expect(res.status).toBe(200);
		expect(vi.mocked(recordDownload)).toHaveBeenCalledWith(expect.anything(), {
			skillVersionId: 1,
			userId: null,
			source: 'cli',
		});
	});

	it('400s an unknown source before any lookup', async () => {
		const res = await app.request('/skills/smoke-clean/1.0.0/download?source=curl');
		expect(res.status).toBe(400);
		expect(vi.mocked(findPublishedSkillBySlug)).not.toHaveBeenCalled();
	});

	it('attributes the event when a valid session cookie rides along', async () => {
		mockVerified();
		await app.request('/skills/smoke-clean/1.0.0/download', {
			headers: { Cookie: await sessionCookie(7) },
		});
		expect(vi.mocked(recordDownload)).toHaveBeenCalledWith(expect.anything(), {
			skillVersionId: 1,
			userId: 7,
			source: 'web',
		});
	});

	it('still serves the download when the event insert fails', async () => {
		mockVerified();
		vi.mocked(recordDownload).mockRejectedValue(new Error('db down'));
		const res = await app.request('/skills/smoke-clean/1.0.0/download');
		expect(res.status).toBe(200);
	});

	it('403s a failed version without touching R2', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue({
			version: verifiedVersion,
			passport: { ...verifiedPassport, validationStatus: 'failed' },
		});
		const res = await app.request('/skills/smoke-clean/1.0.0/download');
		expect(res.status).toBe(403);
		expect(((await res.json()) as { error: string }).error).toBe(BLOCKED_REASON);
		expect(vi.mocked(getSnapshotDocument)).not.toHaveBeenCalled();
		expect(vi.mocked(recordDownload)).not.toHaveBeenCalled();
	});

	it('502s and serves no bytes when the snapshot fails integrity verification', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue({
			version: { ...verifiedVersion, sourceHash: 'sha256:pinned-other' },
			passport: verifiedPassport,
		});
		vi.mocked(getSnapshotDocument).mockResolvedValue({
			success: true,
			data: { version: 1, files: FILES },
		});
		const res = await app.request('/skills/smoke-clean/1.0.0/download');
		expect(res.status).toBe(502);
		expect(res.headers.get('Content-Type')).not.toBe('application/zip');
		expect(vi.mocked(recordDownload)).not.toHaveBeenCalled();
	});

	it('502s when R2 is down', async () => {
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findVersionWithPassport).mockResolvedValue({
			version: verifiedVersion,
			passport: verifiedPassport,
		});
		vi.mocked(getSnapshotDocument).mockResolvedValue({
			success: false,
			error: 'r2 get failed (500)',
		});
		const res = await app.request('/skills/smoke-clean/1.0.0/download');
		expect(res.status).toBe(502);
	});
});

describe('POST /skills/:slug/report', () => {
	const REASON = 'This skill exfiltrates env vars in its install step.';

	function post(body: unknown, cookie?: string) {
		return app.request('/skills/smoke-clean/report', {
			method: 'POST',
			body: JSON.stringify(body),
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
		});
	}

	function mockReporter() {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(record);
		vi.mocked(findOpenReportBySkillAndReporter).mockResolvedValue(undefined);
		vi.mocked(createAbuseReport).mockResolvedValue({
			id: 5,
			skillId: 1,
			reporterId: 1,
			reason: REASON,
			status: 'open',
			createdAt: NOW,
		});
	}

	it('401s without a session', async () => {
		const res = await post({ reason: REASON });
		expect(res.status).toBe(401);
		expect(vi.mocked(createAbuseReport)).not.toHaveBeenCalled();
	});

	it('404s an unknown or unpublished slug', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(findPublishedSkillBySlug).mockResolvedValue(undefined);
		const res = await post({ reason: REASON }, await sessionCookie(1));
		expect(res.status).toBe(404);
	});

	it('400s a too-short reason with the validation message', async () => {
		mockReporter();
		const res = await post({ reason: 'bad' }, await sessionCookie(1));
		expect(res.status).toBe(400);
		expect(((await res.json()) as { error: string }).error).toContain('at least 10');
		expect(vi.mocked(createAbuseReport)).not.toHaveBeenCalled();
	});

	it('409s when the reporter already has an open report', async () => {
		mockReporter();
		vi.mocked(findOpenReportBySkillAndReporter).mockResolvedValue({
			id: 4,
			skillId: 1,
			reporterId: 1,
			reason: 'earlier report',
			status: 'open',
			createdAt: NOW,
		});
		const res = await post({ reason: REASON }, await sessionCookie(1));
		expect(res.status).toBe(409);
		expect(vi.mocked(createAbuseReport)).not.toHaveBeenCalled();
	});

	it('201s with the locked confirmation contract and stores the trimmed reason', async () => {
		mockReporter();
		const res = await post({ reason: `  ${REASON}  ` }, await sessionCookie(1));
		expect(res.status).toBe(201);
		const body = (await res.json()) as { data: unknown };
		expect(publicAbuseReportSchema.parse(body.data)).toEqual({
			status: 'open',
			createdAt: NOW.toISOString(),
		});
		expect(vi.mocked(createAbuseReport)).toHaveBeenCalledWith(expect.anything(), {
			skillId: 1,
			reporterId: 1,
			reason: REASON,
		});
	});

	it('leaks no ids on the confirmation', async () => {
		mockReporter();
		const res = await post({ reason: REASON }, await sessionCookie(1));
		const text = JSON.stringify(await res.json());
		expect(text).not.toContain('reporterId');
		expect(text).not.toContain('skillId');
		expect(text).not.toContain('"id"');
	});
});

describe('POST /skills/:slug/unlist and /skills/:slug/relist', () => {
	it('401s an anonymous request', async () => {
		const res = await app.request('/skills/smoke-clean/unlist', { method: 'POST' });
		expect(res.status).toBe(401);
	});

	it('404s an unknown slug', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		const res = await app.request('/skills/nope/unlist', {
			method: 'POST',
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(404);
		expect(vi.mocked(setSkillStatus)).not.toHaveBeenCalled();
	});

	it("404s someone else's skill - no existence leak", async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...skill, maintainerId: 99 });
		const res = await app.request('/skills/smoke-clean/unlist', {
			method: 'POST',
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(404);
		expect(vi.mocked(setSkillStatus)).not.toHaveBeenCalled();
	});

	it('409s unlisting a skill that is not published', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...skill, status: 'flagged' });
		const res = await app.request('/skills/smoke-clean/unlist', {
			method: 'POST',
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(409);
		expect(vi.mocked(setSkillStatus)).not.toHaveBeenCalled();
	});

	it('unlists a published skill to private', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...skill });
		const res = await app.request('/skills/smoke-clean/unlist', {
			method: 'POST',
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			success: true,
			data: { slug: 'smoke-clean', status: 'private' },
		});
		expect(vi.mocked(setSkillStatus)).toHaveBeenCalledWith(expect.anything(), skill.id, 'private');
	});

	it('409s relisting a skill that is not private', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...skill, status: 'published' });
		const res = await app.request('/skills/smoke-clean/relist', {
			method: 'POST',
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(409);
		expect(vi.mocked(setSkillStatus)).not.toHaveBeenCalled();
	});

	it('relists a private skill to published', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...skill, status: 'private' });
		const res = await app.request('/skills/smoke-clean/relist', {
			method: 'POST',
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			success: true,
			data: { slug: 'smoke-clean', status: 'published' },
		});
		expect(vi.mocked(setSkillStatus)).toHaveBeenCalledWith(
			expect.anything(),
			skill.id,
			'published',
		);
	});
});
