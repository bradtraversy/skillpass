import { Hono } from 'hono';
import { setSignedCookie } from 'hono/cookie';
import { maintainerReportSchema, maintainerSkillSchema } from 'skill-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { SESSION_COOKIE } from '../auth/middleware';
import { listReportsAgainstMaintainer, type MaintainerReportRecord } from '../db/abuse';
import type { Db } from '../db/client';
import type { UserRow } from '../db/schema';
import { listSkillsByMaintainer, type MaintainerSkillRecord } from '../db/skills';
import { findById } from '../db/users';
import { loadEnv } from '../env';
import type { ValidationQueue } from '../queue/queue';
import { RAW_TEST_ENV } from '../testing/env';

vi.mock('../db/skills', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/skills')>()),
	listSkillsByMaintainer: vi.fn(),
}));
vi.mock('../db/abuse', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/abuse')>()),
	listReportsAgainstMaintainer: vi.fn(),
}));
vi.mock('../db/users', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/users')>()),
	findById: vi.fn(),
}));

const env = loadEnv(RAW_TEST_ENV);
const app = createApp(env, {} as Db, {} as ValidationQueue);

const NOW = new Date('2026-08-02T10:00:00.000Z');

const maintainer: UserRow = {
	id: 7,
	githubId: '7',
	username: 'mnt',
	displayName: 'Mnt',
	avatarUrl: 'https://example.com/a.png',
	role: 'maintainer',
	reputation: 0,
	createdAt: NOW,
};

const skillRecord: MaintainerSkillRecord = {
	skill: {
		id: 10,
		slug: 'smoke-clean',
		name: 'smoke-clean',
		summary: 'Clean smoke-test skill.',
		maintainerId: 7,
		attributedTo: null,
		category: 'dev-tooling',
		displayName: 'Smoke Clean',
		tagline: 'Cleans smoke.',
		integrations: [],
		status: 'published',
		featured: false,
		featuredRank: null,
		verified: false,
		latestVersionId: 100,
		createdAt: NOW,
		updatedAt: NOW,
	},
	version: {
		id: 100,
		skillId: 10,
		version: '1.0.0',
		sourceType: 'github',
		githubRepoUrl: null,
		resolvedCommitSha: null,
		sourceHash: 'abc',
		snapshotKey: 'snap/abc',
		targets: ['claude-code'],
		packSkills: null,
		submissionId: 1,
		publishedAt: NOW,
		createdAt: NOW,
	},
	passport: {
		id: 200,
		skillVersionId: 100,
		validationStatus: 'passed',
		riskLevel: 'low',
		passport: {
			schemaVersion: '0.1',
			validationStatus: 'passed',
			riskLevel: 'low',
			permissionsSummary: { declared: [], detected: [] },
			warningsSummary: [],
			distribution: 'skill',
			manifestInferred: false,
			sourceHash: 'abc',
			engineVersion: 'validator-0.1.0',
			generatedAt: NOW.toISOString(),
		},
		generatedAt: NOW,
	},
};

const reportRecord: MaintainerReportRecord = {
	report: {
		id: 4,
		skillId: 10,
		reporterId: 99,
		reason: 'spammy install instructions',
		status: 'open',
		createdAt: NOW,
	},
	skill: { slug: 'smoke-clean', name: 'Smoke Clean' },
};

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

describe('GET /me/skills', () => {
	it('401s an anonymous request', async () => {
		const res = await app.request('/me/skills');
		expect(res.status).toBe(401);
	});

	it('returns the session user skills in the maintainer shape', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(listSkillsByMaintainer).mockResolvedValue([skillRecord]);
		const res = await app.request('/me/skills', {
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(vi.mocked(listSkillsByMaintainer)).toHaveBeenCalledWith(expect.anything(), 7);
		const row = maintainerSkillSchema.parse(body.data[0]);
		expect(row.slug).toBe('smoke-clean');
		expect(row.name).toBe('Smoke Clean');
		expect(row.status).toBe('published');
		expect(row.validationStatus).toBe('passed');
	});

	it('serves a version-less skill with null validation fields', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(listSkillsByMaintainer).mockResolvedValue([
			{ skill: { ...skillRecord.skill, latestVersionId: null }, version: null, passport: null },
		]);
		const res = await app.request('/me/skills', {
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		const body = await res.json();
		const row = maintainerSkillSchema.parse(body.data[0]);
		expect(row.version).toBeNull();
		expect(row.validationStatus).toBeNull();
		expect(row.riskLevel).toBeNull();
	});
});

describe('GET /me/reports', () => {
	it('401s an anonymous request', async () => {
		const res = await app.request('/me/reports');
		expect(res.status).toBe(401);
	});

	it('returns reports against my skills without any reporter fields', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		vi.mocked(listReportsAgainstMaintainer).mockResolvedValue([reportRecord]);
		const res = await app.request('/me/reports', {
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(200);
		const raw = await res.text();
		expect(raw).not.toContain('reporter');
		expect(raw).not.toContain('99');
		const body = JSON.parse(raw);
		expect(vi.mocked(listReportsAgainstMaintainer)).toHaveBeenCalledWith(expect.anything(), 7);
		const row = maintainerReportSchema.parse(body.data[0]);
		expect(row.reason).toBe('spammy install instructions');
		expect(row.skill.slug).toBe('smoke-clean');
	});
});
