import {
	publicSkillDetailSchema,
	publicSkillSourceSchema,
	publicSkillSummarySchema,
} from 'skill-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { Db } from '../db/client';
import type { SkillPassportRow, SkillRow, SkillVersionRow, UserRow } from '../db/schema';
import {
	findPublishedSkillBySlug,
	findVersionWithPassport,
	listPublishedSkills,
	listVersionsWithPassports,
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
	findVersionWithPassport: vi.fn(),
	listVersionsWithPassports: vi.fn(),
}));
vi.mock('../storage/r2', async (importOriginal) => ({
	...(await importOriginal<typeof import('../storage/r2')>()),
	getSnapshotDocument: vi.fn(),
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
	status: 'published',
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
		sourceHash: 'sha256:abc',
		engineVersion: 'validator-0.1.0',
		generatedAt: NOW.toISOString(),
	},
	validationStatus: 'passed',
	riskLevel: 'low',
	generatedAt: NOW,
};

const record: PublishedSkillRecord = { skill, version, passport, maintainer };

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
			version: '1.0.0',
			maintainer: 'bradtraversy',
			attributedTo: null,
			publishedAt: NOW.toISOString(),
		});
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
