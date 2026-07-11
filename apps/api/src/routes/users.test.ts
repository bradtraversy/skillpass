import { publicProfileSchema } from 'skill-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { Db } from '../db/client';
import type { SkillPassportRow, SkillRow, SkillVersionRow, UserRow } from '../db/schema';
import { listPublishedSkillsByMaintainer } from '../db/skills';
import { findByUsername } from '../db/users';
import { loadEnv } from '../env';
import type { ValidationQueue } from '../queue/queue';
import { RAW_TEST_ENV } from '../testing/env';

vi.mock('../db/users', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/users')>()),
	findByUsername: vi.fn(),
}));
vi.mock('../db/skills', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/skills')>()),
	listPublishedSkillsByMaintainer: vi.fn(),
}));

const env = loadEnv(RAW_TEST_ENV);
const app = createApp(env, {} as Db, {} as ValidationQueue);

const NOW = new Date('2026-07-08T12:00:00.000Z');

const maintainer: UserRow = {
	id: 1,
	githubId: '12345',
	username: 'bradtraversy',
	displayName: 'Brad Traversy',
	avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
	role: 'admin',
	reputation: 12,
	createdAt: new Date('2026-07-04T10:00:00Z'),
};

const skill: SkillRow = {
	id: 1,
	slug: 'smoke-clean',
	name: 'smoke-clean',
	summary: 'Clean smoke-test skill.',
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

beforeEach(() => vi.clearAllMocks());

describe('GET /users/:username', () => {
	it('404s an unknown username', async () => {
		vi.mocked(findByUsername).mockResolvedValue(undefined);
		const res = await app.request('/users/nobody');
		expect(res.status).toBe(404);
		expect(vi.mocked(listPublishedSkillsByMaintainer)).not.toHaveBeenCalled();
	});

	it('returns a profile that parses with the locked contract, skills included', async () => {
		vi.mocked(findByUsername).mockResolvedValue(maintainer);
		vi.mocked(listPublishedSkillsByMaintainer).mockResolvedValue([
			{ skill, version, passport, maintainer },
		]);
		const res = await app.request('/users/bradtraversy');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		const profile = publicProfileSchema.parse(body.data);
		expect(profile.username).toBe('bradtraversy');
		expect(profile.reputation).toBe(12);
		expect(profile.joinedAt).toBe('2026-07-04T10:00:00.000Z');
		expect(profile.skills).toHaveLength(1);
		expect(profile.skills[0].slug).toBe('smoke-clean');
		expect(vi.mocked(listPublishedSkillsByMaintainer)).toHaveBeenCalledWith(expect.anything(), 1);
	});

	it('resolves a user with no published skills to an empty list', async () => {
		vi.mocked(findByUsername).mockResolvedValue(maintainer);
		vi.mocked(listPublishedSkillsByMaintainer).mockResolvedValue([]);
		const res = await app.request('/users/bradtraversy');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		expect(publicProfileSchema.parse(body.data).skills).toEqual([]);
	});

	it('leaks no internal fields', async () => {
		vi.mocked(findByUsername).mockResolvedValue(maintainer);
		vi.mocked(listPublishedSkillsByMaintainer).mockResolvedValue([
			{ skill, version, passport, maintainer },
		]);
		const res = await app.request('/users/bradtraversy');
		const text = JSON.stringify(await res.json());
		expect(text).not.toContain('githubId');
		expect(text).not.toContain('"role"');
		expect(text).not.toContain('snapshotKey');
		expect(text).not.toContain('submissionId');
	});
});
