import { Hono } from 'hono';
import { setSignedCookie } from 'hono/cookie';
import { adminAbuseReportSchema, adminQueueSchema, adminVersionHistorySchema } from 'skill-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { SESSION_COOKIE } from '../auth/middleware';
import {
	findAdminReportById,
	listOpenAbuseReports,
	setAbuseReportStatus,
	type AdminAbuseReportDetail,
	type AdminAbuseReportRecord,
} from '../db/abuse';
import type { Db } from '../db/client';
import type { SkillRow, SubmissionRow, UserRow, ValidationReportRow } from '../db/schema';
import {
	findSkillBySlug,
	listFlaggedSkills,
	listSkillValidationHistory,
	setSkillCuration,
	setSkillStatus,
	type FlaggedSkillRecord,
} from '../db/skills';
import { listFailedSubmissions, type FailedSubmissionRecord } from '../db/submissions';
import { findById } from '../db/users';
import { loadEnv } from '../env';
import type { ValidationQueue } from '../queue/queue';
import { awardReputation } from '../reputation/reputation';
import { RAW_TEST_ENV } from '../testing/env';

vi.mock('../db/abuse', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/abuse')>()),
	listOpenAbuseReports: vi.fn(),
	findAdminReportById: vi.fn(),
	setAbuseReportStatus: vi.fn(),
}));
vi.mock('../db/submissions', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/submissions')>()),
	listFailedSubmissions: vi.fn(),
}));
vi.mock('../db/skills', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/skills')>()),
	listFlaggedSkills: vi.fn(),
	findSkillBySlug: vi.fn(),
	setSkillStatus: vi.fn(),
	setSkillCuration: vi.fn(),
	listSkillValidationHistory: vi.fn(),
}));
vi.mock('../db/users', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/users')>()),
	findById: vi.fn(),
}));
vi.mock('../reputation/reputation', async (importOriginal) => ({
	...(await importOriginal<typeof import('../reputation/reputation')>()),
	awardReputation: vi.fn(),
}));

const env = loadEnv(RAW_TEST_ENV);
const app = createApp(env, {} as Db, {} as ValidationQueue);

const NOW = new Date('2026-07-09T10:00:00.000Z');

const admin: UserRow = {
	id: 1,
	githubId: '1',
	username: 'brad',
	displayName: 'Brad',
	avatarUrl: 'https://example.com/a.png',
	role: 'admin',
	reputation: 0,
	createdAt: NOW,
};
const maintainer: UserRow = { ...admin, id: 2, username: 'mnt', role: 'maintainer' };

const reportRecord: AdminAbuseReportRecord = {
	report: { id: 1, skillId: 10, reporterId: 5, reason: 'stolen skill', status: 'open', createdAt: NOW },
	skill: { slug: 'bad-skill', name: 'Bad Skill' },
	reporter: { username: 'reporter' },
};

const failedSubmission: SubmissionRow = {
	id: 7,
	userId: 5,
	sourceType: 'github_url',
	githubUrl: 'https://github.com/x/y',
	uploadedZipKey: null,
	status: 'failed',
	resolvedCommitSha: 'abc123',
	sourceHash: 'hash7',
	snapshotKey: 'snapshots/hash7.json',
	createdAt: NOW,
};
const failedReport: ValidationReportRow = {
	id: 3,
	submissionId: 7,
	status: 'failed',
	riskLevel: 'high',
	sourceHash: 'hash7',
	engineVersion: '0.1',
	report: {
		schemaVersion: '0.1',
		status: 'failed',
		riskLevel: 'high',
		sourceHash: 'hash7',
		engineVersion: '0.1',
		permissionsDeclared: [],
		permissionsDetected: [],
		warnings: [],
		failures: [{ code: 'secret', message: 'hardcoded token' }],
		createdAt: NOW.toISOString(),
	},
	createdAt: NOW,
};
const failedRecord: FailedSubmissionRecord = {
	submission: failedSubmission,
	user: { username: 'submitter' },
	report: failedReport,
};

const flaggedRecord: FlaggedSkillRecord = {
	skill: { slug: 'flagged-one', name: 'Flagged One' },
	maintainer: { username: 'owner' },
};

const MAINTAINER_ID = 42;
const reportDetail: AdminAbuseReportDetail = {
	report: { id: 1, skillId: 10, reporterId: 5, reason: 'stolen skill', status: 'open', createdAt: NOW },
	skill: { slug: 'bad-skill', name: 'Bad Skill', maintainerId: MAINTAINER_ID },
	reporter: { username: 'reporter' },
};

const publishedSkill: SkillRow = {
	id: 10,
	slug: 'bad-skill',
	name: 'Bad Skill',
	summary: 'a skill',
	maintainerId: MAINTAINER_ID,
	attributedTo: null,
	status: 'published',
	featured: false,
	verified: false,
	latestVersionId: 100,
	createdAt: NOW,
	updatedAt: NOW,
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

describe('GET /admin/queue', () => {
	it('401s an anonymous request', async () => {
		const res = await app.request('/admin/queue');
		expect(res.status).toBe(401);
	});

	it('403s a signed-in non-admin', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		const res = await app.request('/admin/queue', {
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(403);
		// A non-admin must never see queue data.
		expect(vi.mocked(listOpenAbuseReports)).not.toHaveBeenCalled();
	});

	it('returns the three queue lists to an admin, parsing the locked contract', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(listOpenAbuseReports).mockResolvedValue([reportRecord]);
		vi.mocked(listFailedSubmissions).mockResolvedValue([failedRecord]);
		vi.mocked(listFlaggedSkills).mockResolvedValue([flaggedRecord]);

		const res = await app.request('/admin/queue', {
			headers: { Cookie: await sessionCookie(admin.id) },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		const queue = adminQueueSchema.parse(body.data);
		expect(queue.reports).toEqual([
			{
				id: 1,
				reason: 'stolen skill',
				status: 'open',
				createdAt: NOW.toISOString(),
				skill: { slug: 'bad-skill', name: 'Bad Skill' },
				reporter: { username: 'reporter' },
			},
		]);
		expect(queue.failedSubmissions[0].report?.failures).toEqual([
			{ code: 'secret', message: 'hardcoded token' },
		]);
		expect(queue.flaggedSkills).toEqual([
			{ slug: 'flagged-one', name: 'Flagged One', maintainer: { username: 'owner' } },
		]);
	});

	it('returns empty lists when nothing needs review', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(listOpenAbuseReports).mockResolvedValue([]);
		vi.mocked(listFailedSubmissions).mockResolvedValue([]);
		vi.mocked(listFlaggedSkills).mockResolvedValue([]);

		const res = await app.request('/admin/queue', {
			headers: { Cookie: await sessionCookie(admin.id) },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		expect(adminQueueSchema.parse(body.data)).toEqual({
			reports: [],
			failedSubmissions: [],
			flaggedSkills: [],
		});
	});

	it('leaks no internal fields', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(listOpenAbuseReports).mockResolvedValue([reportRecord]);
		vi.mocked(listFailedSubmissions).mockResolvedValue([failedRecord]);
		vi.mocked(listFlaggedSkills).mockResolvedValue([]);

		const res = await app.request('/admin/queue', {
			headers: { Cookie: await sessionCookie(admin.id) },
		});
		const text = JSON.stringify(await res.json());
		expect(text).not.toContain('snapshotKey');
		expect(text).not.toContain('reporterId');
		expect(text).not.toContain('userId');
	});
});

describe('POST /admin/reports/:id/resolve', () => {
	async function resolve(id: number, body: unknown, cookie?: string) {
		return app.request(`/admin/reports/${id}/resolve`, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
		});
	}

	it('401s an anonymous request', async () => {
		const res = await resolve(1, { status: 'actioned' });
		expect(res.status).toBe(401);
	});

	it('403s a signed-in non-admin, touching nothing', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		const res = await resolve(1, { status: 'actioned' }, await sessionCookie(maintainer.id));
		expect(res.status).toBe(403);
		expect(vi.mocked(awardReputation)).not.toHaveBeenCalled();
		expect(vi.mocked(setAbuseReportStatus)).not.toHaveBeenCalled();
	});

	it('actioned: docks the maintainer once, then sets the status', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findAdminReportById).mockResolvedValue(reportDetail);
		const res = await resolve(1, { status: 'actioned' }, await sessionCookie(admin.id));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		expect(adminAbuseReportSchema.parse(body.data).status).toBe('actioned');
		expect(vi.mocked(awardReputation)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(awardReputation)).toHaveBeenCalledWith(
			expect.anything(),
			MAINTAINER_ID,
			'report_actioned',
		);
		expect(vi.mocked(setAbuseReportStatus)).toHaveBeenCalledWith(expect.anything(), 1, 'actioned');
	});

	it('reviewed: sets the status with no reputation change', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findAdminReportById).mockResolvedValue(reportDetail);
		const res = await resolve(1, { status: 'reviewed' }, await sessionCookie(admin.id));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown };
		expect(adminAbuseReportSchema.parse(body.data).status).toBe('reviewed');
		expect(vi.mocked(awardReputation)).not.toHaveBeenCalled();
		expect(vi.mocked(setAbuseReportStatus)).toHaveBeenCalledWith(expect.anything(), 1, 'reviewed');
	});

	it('409s a report that is not open, docking nothing', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findAdminReportById).mockResolvedValue({
			...reportDetail,
			report: { ...reportDetail.report, status: 'actioned' },
		});
		const res = await resolve(1, { status: 'actioned' }, await sessionCookie(admin.id));
		expect(res.status).toBe(409);
		expect(vi.mocked(awardReputation)).not.toHaveBeenCalled();
		expect(vi.mocked(setAbuseReportStatus)).not.toHaveBeenCalled();
	});

	it('400s an invalid status, without a lookup', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		const res = await resolve(1, { status: 'open' }, await sessionCookie(admin.id));
		expect(res.status).toBe(400);
		expect(vi.mocked(findAdminReportById)).not.toHaveBeenCalled();
	});

	it('404s an unknown report', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findAdminReportById).mockResolvedValue(undefined);
		const res = await resolve(999, { status: 'actioned' }, await sessionCookie(admin.id));
		expect(res.status).toBe(404);
		expect(vi.mocked(awardReputation)).not.toHaveBeenCalled();
	});
});

describe('POST /admin/skills/:slug/flag', () => {
	function flag(slug: string, cookie?: string) {
		return app.request(`/admin/skills/${slug}/flag`, {
			method: 'POST',
			headers: { ...(cookie ? { Cookie: cookie } : {}) },
		});
	}

	it('403s a non-admin, changing nothing', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		const res = await flag('bad-skill', await sessionCookie(maintainer.id));
		expect(res.status).toBe(403);
		expect(vi.mocked(setSkillStatus)).not.toHaveBeenCalled();
	});

	it('flags a published skill', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue(publishedSkill);
		const res = await flag('bad-skill', await sessionCookie(admin.id));
		expect(res.status).toBe(200);
		expect((await res.json()).data).toEqual({ slug: 'bad-skill', status: 'flagged' });
		expect(vi.mocked(setSkillStatus)).toHaveBeenCalledWith(expect.anything(), 10, 'flagged');
	});

	it('409s a skill that is not published', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...publishedSkill, status: 'flagged' });
		const res = await flag('bad-skill', await sessionCookie(admin.id));
		expect(res.status).toBe(409);
		expect(vi.mocked(setSkillStatus)).not.toHaveBeenCalled();
	});

	it('404s an unknown slug', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		const res = await flag('nope', await sessionCookie(admin.id));
		expect(res.status).toBe(404);
	});
});

describe('POST /admin/skills/:slug/unflag', () => {
	function unflag(slug: string, cookie?: string) {
		return app.request(`/admin/skills/${slug}/unflag`, {
			method: 'POST',
			headers: { ...(cookie ? { Cookie: cookie } : {}) },
		});
	}

	it('unflags a flagged skill back to published', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...publishedSkill, status: 'flagged' });
		const res = await unflag('bad-skill', await sessionCookie(admin.id));
		expect(res.status).toBe(200);
		expect((await res.json()).data).toEqual({ slug: 'bad-skill', status: 'published' });
		expect(vi.mocked(setSkillStatus)).toHaveBeenCalledWith(expect.anything(), 10, 'published');
	});

	it('409s a skill that is not flagged', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue(publishedSkill);
		const res = await unflag('bad-skill', await sessionCookie(admin.id));
		expect(res.status).toBe(409);
		expect(vi.mocked(setSkillStatus)).not.toHaveBeenCalled();
	});
});

describe('POST /admin/skills/:slug/{feature,verify}', () => {
	function curate(action: 'feature' | 'verify', slug: string, body: unknown, cookie?: string) {
		return app.request(`/admin/skills/${slug}/${action}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
			body: JSON.stringify(body),
		});
	}

	it('403s a non-admin, changing nothing', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		const res = await curate('feature', 'bad-skill', { value: true }, await sessionCookie(maintainer.id));
		expect(res.status).toBe(403);
		expect(vi.mocked(setSkillCuration)).not.toHaveBeenCalled();
	});

	it('features a published skill', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue(publishedSkill);
		const res = await curate('feature', 'bad-skill', { value: true }, await sessionCookie(admin.id));
		expect(res.status).toBe(200);
		expect((await res.json()).data).toEqual({ slug: 'bad-skill', featured: true });
		expect(vi.mocked(setSkillCuration)).toHaveBeenCalledWith(expect.anything(), 10, { featured: true });
	});

	it('verifies, and can unset, a published skill', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue(publishedSkill);
		const res = await curate('verify', 'bad-skill', { value: false }, await sessionCookie(admin.id));
		expect(res.status).toBe(200);
		expect((await res.json()).data).toEqual({ slug: 'bad-skill', verified: false });
		expect(vi.mocked(setSkillCuration)).toHaveBeenCalledWith(expect.anything(), 10, { verified: false });
	});

	it('409s a skill that is not published', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...publishedSkill, status: 'flagged' });
		const res = await curate('feature', 'bad-skill', { value: true }, await sessionCookie(admin.id));
		expect(res.status).toBe(409);
		expect(vi.mocked(setSkillCuration)).not.toHaveBeenCalled();
	});

	it('404s an unknown slug', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		const res = await curate('feature', 'nope', { value: true }, await sessionCookie(admin.id));
		expect(res.status).toBe(404);
	});

	it('400s a non-boolean value, without a lookup', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		const res = await curate('feature', 'bad-skill', { value: 'yes' }, await sessionCookie(admin.id));
		expect(res.status).toBe(400);
		expect(vi.mocked(setSkillCuration)).not.toHaveBeenCalled();
	});
});

describe('GET /admin/skills/:slug/history', () => {
	it('403s a non-admin', async () => {
		vi.mocked(findById).mockResolvedValue(maintainer);
		const res = await app.request('/admin/skills/bad-skill/history', {
			headers: { Cookie: await sessionCookie(maintainer.id) },
		});
		expect(res.status).toBe(403);
	});

	it('returns each version verdict, parsing the locked contract', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue(publishedSkill);
		vi.mocked(listSkillValidationHistory).mockResolvedValue([
			{
				version: '2.0.0',
				publishedAt: NOW.toISOString(),
				validationStatus: 'passed',
				riskLevel: 'low',
				warnings: [],
				failures: [],
				sourceHash: 'h2',
				resolvedCommitSha: null,
			},
		]);
		const res = await app.request('/admin/skills/bad-skill/history', {
			headers: { Cookie: await sessionCookie(admin.id) },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown[] };
		const history = adminVersionHistorySchema.array().parse(body.data);
		expect(history[0].version).toBe('2.0.0');
	});

	it('404s an unknown slug', async () => {
		vi.mocked(findById).mockResolvedValue(admin);
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		const res = await app.request('/admin/skills/nope/history', {
			headers: { Cookie: await sessionCookie(admin.id) },
		});
		expect(res.status).toBe(404);
	});
});
