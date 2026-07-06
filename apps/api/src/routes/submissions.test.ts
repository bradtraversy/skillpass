import { Hono } from 'hono';
import { setSignedCookie } from 'hono/cookie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPackageFromFiles } from 'validator';
import { createApp } from '../app';
import { SESSION_COOKIE } from '../auth/middleware';
import type { Db } from '../db/client';
import type { SubmissionRow, UserRow } from '../db/schema';
import { createSubmission, findSubmissionForUser, listSubmissionsForUser } from '../db/submissions';
import { findById } from '../db/users';
import { loadEnv } from '../env';
import { sourceError } from '../github/errors';
import { resolveCommit } from '../github/pin';
import { fetchSnapshot } from '../github/snapshot';
import { putJson } from '../storage/r2';
import { RAW_TEST_ENV } from '../testing/env';

vi.mock('../db/users', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/users')>()),
	findById: vi.fn(),
}));
vi.mock('../db/submissions', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/submissions')>()),
	createSubmission: vi.fn(),
	listSubmissionsForUser: vi.fn(),
	findSubmissionForUser: vi.fn(),
}));
vi.mock('../github/pin', async (importOriginal) => ({
	...(await importOriginal<typeof import('../github/pin')>()),
	resolveCommit: vi.fn(),
}));
vi.mock('../github/snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('../github/snapshot')>()),
	fetchSnapshot: vi.fn(),
}));
vi.mock('../storage/r2', async (importOriginal) => ({
	...(await importOriginal<typeof import('../storage/r2')>()),
	putJson: vi.fn(),
}));

const env = loadEnv(RAW_TEST_ENV);
const app = createApp(env, {} as Db);

const userRow: UserRow = {
	id: 7,
	githubId: '12345',
	username: 'bradtraversy',
	displayName: 'Brad Traversy',
	avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
	role: 'maintainer',
	reputation: 0,
	createdAt: new Date('2026-07-04T10:00:00Z'),
};

const FILES = [{ path: 'SKILL.md', content: '# Demo\n' }];
const HASH = loadPackageFromFiles(FILES).sourceHash;
const KEY = `snapshots/${HASH.slice('sha256:'.length)}.json`;

const submissionRow: SubmissionRow = {
	id: 1,
	userId: 7,
	sourceType: 'github_url',
	githubUrl: 'https://github.com/octocat/hello',
	uploadedZipKey: null,
	status: 'draft',
	resolvedCommitSha: 'abc123',
	sourceHash: HASH,
	snapshotKey: KEY,
	createdAt: new Date('2026-07-05T12:00:00Z'),
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

function mockHappyPath() {
	vi.mocked(findById).mockResolvedValue(userRow);
	vi.mocked(resolveCommit).mockResolvedValue({ success: true, data: 'abc123' });
	vi.mocked(fetchSnapshot).mockResolvedValue({ success: true, data: FILES });
	vi.mocked(putJson).mockResolvedValue({ success: true, data: null });
	vi.mocked(createSubmission).mockResolvedValue(submissionRow);
}

async function post(body: unknown, cookie?: string): Promise<Response> {
	return app.request('/submissions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	});
}

beforeEach(() => vi.clearAllMocks());

describe('POST /submissions', () => {
	it('401s without a session', async () => {
		const res = await post({ githubUrl: 'https://github.com/octocat/hello' });
		expect(res.status).toBe(401);
		expect(vi.mocked(resolveCommit)).not.toHaveBeenCalled();
	});

	it('creates a draft and returns the locked public shape', async () => {
		mockHappyPath();
		const res = await post({ githubUrl: 'https://github.com/octocat/hello' }, await sessionCookie(7));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({
			success: true,
			data: {
				id: 1,
				sourceType: 'github_url',
				githubUrl: 'https://github.com/octocat/hello',
				status: 'draft',
				resolvedCommitSha: 'abc123',
				sourceHash: HASH,
				createdAt: '2026-07-05T12:00:00.000Z',
			},
		});
		expect(vi.mocked(putJson)).toHaveBeenCalledWith(env, KEY, { version: 1, files: FILES });
		expect(vi.mocked(createSubmission)).toHaveBeenCalledWith(expect.anything(), {
			userId: 7,
			sourceType: 'github_url',
			githubUrl: 'https://github.com/octocat/hello',
			resolvedCommitSha: 'abc123',
			sourceHash: HASH,
			snapshotKey: KEY,
		});
	});

	it('400s on a non-JSON body', async () => {
		mockHappyPath();
		const res = await post('not json', await sessionCookie(7));
		expect(res.status).toBe(400);
	});

	it('400s on a missing githubUrl', async () => {
		mockHappyPath();
		const res = await post({}, await sessionCookie(7));
		expect(res.status).toBe(400);
	});

	it('400s on a non-github URL without calling github', async () => {
		mockHappyPath();
		const res = await post({ githubUrl: 'https://gitlab.com/octocat/hello' }, await sessionCookie(7));
		expect(res.status).toBe(400);
		expect(vi.mocked(resolveCommit)).not.toHaveBeenCalled();
	});

	it('404s when the repo cannot be pinned and never snapshots', async () => {
		mockHappyPath();
		vi.mocked(resolveCommit).mockResolvedValue(sourceError('not-found', 'repository not found'));
		const res = await post({ githubUrl: 'https://github.com/octocat/gone' }, await sessionCookie(7));
		expect(res.status).toBe(404);
		expect(vi.mocked(fetchSnapshot)).not.toHaveBeenCalled();
	});

	it('429s when github rate-limits the pin', async () => {
		mockHappyPath();
		vi.mocked(resolveCommit).mockResolvedValue(sourceError('rate-limited', 'rate limit hit'));
		const res = await post({ githubUrl: 'https://github.com/octocat/hello' }, await sessionCookie(7));
		expect(res.status).toBe(429);
	});

	it('413s an over-cap package and never stores it', async () => {
		mockHappyPath();
		vi.mocked(fetchSnapshot).mockResolvedValue(sourceError('too-large', 'package exceeds 500 files'));
		const res = await post({ githubUrl: 'https://github.com/octocat/huge' }, await sessionCookie(7));
		expect(res.status).toBe(413);
		expect(vi.mocked(putJson)).not.toHaveBeenCalled();
	});

	it('502s when the snapshot cannot be stored and never inserts', async () => {
		mockHappyPath();
		vi.mocked(putJson).mockResolvedValue({ success: false, error: 'r2 put failed (500)' });
		const res = await post({ githubUrl: 'https://github.com/octocat/hello' }, await sessionCookie(7));
		expect(res.status).toBe(502);
		expect(vi.mocked(createSubmission)).not.toHaveBeenCalled();
	});

	it('500s with the standard shape when the insert throws', async () => {
		mockHappyPath();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(createSubmission).mockRejectedValue(new Error('db down'));
		const res = await post({ githubUrl: 'https://github.com/octocat/hello' }, await sessionCookie(7));
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ success: false, error: 'internal error' });
	});
});

const publicShape = {
	id: 1,
	sourceType: 'github_url',
	githubUrl: 'https://github.com/octocat/hello',
	status: 'draft',
	resolvedCommitSha: 'abc123',
	sourceHash: HASH,
	createdAt: '2026-07-05T12:00:00.000Z',
};

describe('GET /submissions', () => {
	it('401s without a session', async () => {
		const res = await app.request('/submissions');
		expect(res.status).toBe(401);
	});

	it("lists only the authed user's submissions in the public shape", async () => {
		vi.mocked(findById).mockResolvedValue(userRow);
		vi.mocked(listSubmissionsForUser).mockResolvedValue([submissionRow]);
		const res = await app.request('/submissions', { headers: { Cookie: await sessionCookie(7) } });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true, data: [publicShape] });
		expect(vi.mocked(listSubmissionsForUser)).toHaveBeenCalledWith(expect.anything(), 7);
	});
});

describe('GET /submissions/:id', () => {
	it('returns an owned submission in the public shape', async () => {
		vi.mocked(findById).mockResolvedValue(userRow);
		vi.mocked(findSubmissionForUser).mockResolvedValue(submissionRow);
		const res = await app.request('/submissions/1', { headers: { Cookie: await sessionCookie(7) } });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true, data: publicShape });
		expect(vi.mocked(findSubmissionForUser)).toHaveBeenCalledWith(expect.anything(), 7, 1);
	});

	it("404s another user's submission with no existence leak", async () => {
		vi.mocked(findById).mockResolvedValue(userRow);
		// The user-scoped query returns nothing for a row user 7 does not own.
		vi.mocked(findSubmissionForUser).mockResolvedValue(undefined);
		const res = await app.request('/submissions/2', { headers: { Cookie: await sessionCookie(7) } });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ success: false, error: 'not found' });
		expect(vi.mocked(findSubmissionForUser)).toHaveBeenCalledWith(expect.anything(), 7, 2);
	});

	it('404s a non-numeric id without touching the db', async () => {
		vi.mocked(findById).mockResolvedValue(userRow);
		const res = await app.request('/submissions/abc', { headers: { Cookie: await sessionCookie(7) } });
		expect(res.status).toBe(404);
		expect(vi.mocked(findSubmissionForUser)).not.toHaveBeenCalled();
	});
});
