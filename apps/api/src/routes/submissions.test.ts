import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { Hono } from 'hono';
import { setSignedCookie } from 'hono/cookie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPackageFromFiles } from 'validator';
import { createApp } from '../app';
import { SESSION_COOKIE } from '../auth/middleware';
import type { Db } from '../db/client';
import type { SubmissionRow, UserRow, ValidationJobRow } from '../db/schema';
import { createSubmission, findSubmissionForUser, listSubmissionsForUser } from '../db/submissions';
import { findById } from '../db/users';
import {
	createValidationJob,
	findValidationJobForSubmission,
	findValidationReportForSubmission,
	markValidationJobError,
	setValidationJobBullId,
} from '../db/validation';
import { loadEnv } from '../env';
import { enqueueValidation, type ValidationQueue } from '../queue/queue';
import { sourceError } from '../github/errors';
import { verifySubmitPermission } from '../github/ownership';
import { resolveCommit } from '../github/pin';
import { fetchSnapshot } from '../github/snapshot';
import { putBytes, putJson } from '../storage/r2';
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
vi.mock('../db/validation', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/validation')>()),
	createValidationJob: vi.fn(),
	setValidationJobBullId: vi.fn(),
	markValidationJobError: vi.fn(),
	findValidationJobForSubmission: vi.fn(),
	findValidationReportForSubmission: vi.fn(),
}));
vi.mock('../queue/queue', async (importOriginal) => ({
	...(await importOriginal<typeof import('../queue/queue')>()),
	enqueueValidation: vi.fn(),
}));
vi.mock('../github/ownership', async (importOriginal) => ({
	...(await importOriginal<typeof import('../github/ownership')>()),
	verifySubmitPermission: vi.fn(),
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
	putBytes: vi.fn(),
}));

const env = loadEnv(RAW_TEST_ENV);
const app = createApp(env, {} as Db, {} as ValidationQueue);

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

const jobRow: ValidationJobRow = {
	id: 55,
	submissionId: 1,
	state: 'queued',
	progress: [],
	bullJobId: null,
	error: null,
	startedAt: null,
	finishedAt: null,
	createdAt: new Date('2026-07-06T09:00:00Z'),
};

function mockHappyPath() {
	vi.mocked(findById).mockResolvedValue(userRow);
	vi.mocked(verifySubmitPermission).mockResolvedValue({ success: true, data: null });
	vi.mocked(resolveCommit).mockResolvedValue({ success: true, data: 'abc123' });
	vi.mocked(fetchSnapshot).mockResolvedValue({ success: true, data: FILES });
	vi.mocked(putJson).mockResolvedValue({ success: true, data: null });
	vi.mocked(putBytes).mockResolvedValue({ success: true, data: null });
	vi.mocked(createSubmission).mockResolvedValue(submissionRow);
	vi.mocked(createValidationJob).mockResolvedValue(jobRow);
	vi.mocked(enqueueValidation).mockResolvedValue({ success: true, data: 'bull-1' });
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

	it("403s a repo the user doesn't own and never pins it", async () => {
		mockHappyPath();
		vi.mocked(verifySubmitPermission).mockResolvedValue(
			sourceError('forbidden', 'you can only submit repositories you own'),
		);
		const res = await post({ githubUrl: 'https://github.com/octocat/hello' }, await sessionCookie(7));
		expect(res.status).toBe(403);
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

	it('creates a queued job row and enqueues validation after the draft', async () => {
		mockHappyPath();
		const res = await post({ githubUrl: 'https://github.com/octocat/hello' }, await sessionCookie(7));
		expect(res.status).toBe(201);
		expect(vi.mocked(createValidationJob)).toHaveBeenCalledWith(expect.anything(), 1);
		expect(vi.mocked(enqueueValidation)).toHaveBeenCalledWith(expect.anything(), 1);
		expect(vi.mocked(setValidationJobBullId)).toHaveBeenCalledWith(expect.anything(), 55, 'bull-1');
		expect(vi.mocked(markValidationJobError)).not.toHaveBeenCalled();
	});

	it('still 201s when Redis is down, recording the error on the job row', async () => {
		mockHappyPath();
		vi.mocked(enqueueValidation).mockResolvedValue({
			success: false,
			error: 'enqueue failed: connect ECONNREFUSED',
		});
		const res = await post({ githubUrl: 'https://github.com/octocat/hello' }, await sessionCookie(7));
		expect(res.status).toBe(201);
		expect((await res.json()) as { success: boolean }).toMatchObject({ success: true });
		expect(vi.mocked(markValidationJobError)).toHaveBeenCalledWith(
			expect.anything(),
			55,
			'enqueue failed: connect ECONNREFUSED',
		);
		expect(vi.mocked(setValidationJobBullId)).not.toHaveBeenCalled();
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

describe('POST /submissions/zip', () => {
	const ZIP_BYTES = zipSync({ 'demo-skill/SKILL.md': strToU8('# Demo\n') });
	const ZIP_KEY = `uploads/${createHash('sha256').update(ZIP_BYTES).digest('hex')}.zip`;

	const zipRow: SubmissionRow = {
		id: 3,
		userId: 7,
		sourceType: 'zip',
		githubUrl: null,
		uploadedZipKey: ZIP_KEY,
		status: 'draft',
		resolvedCommitSha: null,
		sourceHash: HASH,
		snapshotKey: KEY,
		createdAt: new Date('2026-07-06T09:00:00Z'),
	};

	async function postZip(file: File | undefined, cookie?: string): Promise<Response> {
		const form = new FormData();
		if (file) form.set('file', file);
		return app.request('/submissions/zip', {
			method: 'POST',
			headers: cookie ? { Cookie: cookie } : {},
			body: form,
		});
	}

	it('401s without a session', async () => {
		const res = await postZip(new File([ZIP_BYTES], 'demo.zip'));
		expect(res.status).toBe(401);
	});

	it('creates a zip draft through the real extractor', async () => {
		mockHappyPath();
		vi.mocked(createSubmission).mockResolvedValue(zipRow);
		const res = await postZip(new File([ZIP_BYTES], 'Demo Skill.zip'), await sessionCookie(7));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({
			success: true,
			data: {
				id: 3,
				sourceType: 'zip',
				githubUrl: null,
				status: 'draft',
				resolvedCommitSha: null,
				sourceHash: HASH,
				createdAt: '2026-07-06T09:00:00.000Z',
			},
		});
		expect(vi.mocked(putBytes)).toHaveBeenCalledWith(
			env,
			ZIP_KEY,
			expect.any(Uint8Array),
			'application/zip',
		);
		expect(vi.mocked(putJson)).toHaveBeenCalledWith(env, KEY, { version: 1, files: FILES });
		expect(vi.mocked(createSubmission)).toHaveBeenCalledWith(expect.anything(), {
			userId: 7,
			sourceType: 'zip',
			uploadedZipKey: ZIP_KEY,
			sourceHash: HASH,
			snapshotKey: KEY,
		});
	});

	it('creates a queued job row and enqueues validation after the zip draft', async () => {
		mockHappyPath();
		vi.mocked(createSubmission).mockResolvedValue(zipRow);
		vi.mocked(createValidationJob).mockResolvedValue({ ...jobRow, submissionId: 3 });
		const res = await postZip(new File([ZIP_BYTES], 'demo.zip'), await sessionCookie(7));
		expect(res.status).toBe(201);
		expect(vi.mocked(createValidationJob)).toHaveBeenCalledWith(expect.anything(), 3);
		expect(vi.mocked(enqueueValidation)).toHaveBeenCalledWith(expect.anything(), 3);
		expect(vi.mocked(setValidationJobBullId)).toHaveBeenCalledWith(expect.anything(), 55, 'bull-1');
	});

	it('still 201s a zip when Redis is down, recording the error on the job row', async () => {
		mockHappyPath();
		vi.mocked(createSubmission).mockResolvedValue(zipRow);
		vi.mocked(createValidationJob).mockResolvedValue({ ...jobRow, submissionId: 3 });
		vi.mocked(enqueueValidation).mockResolvedValue({
			success: false,
			error: 'enqueue failed: connect ECONNREFUSED',
		});
		const res = await postZip(new File([ZIP_BYTES], 'demo.zip'), await sessionCookie(7));
		expect(res.status).toBe(201);
		expect(vi.mocked(markValidationJobError)).toHaveBeenCalledWith(
			expect.anything(),
			55,
			'enqueue failed: connect ECONNREFUSED',
		);
		expect(vi.mocked(setValidationJobBullId)).not.toHaveBeenCalled();
	});

	it('400s when the file field is missing', async () => {
		mockHappyPath();
		const res = await postZip(undefined, await sessionCookie(7));
		expect(res.status).toBe(400);
	});

	it('413s an over-cap zip without buffering or storing it', async () => {
		mockHappyPath();
		const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.zip');
		const res = await postZip(big, await sessionCookie(7));
		expect(res.status).toBe(413);
		expect(vi.mocked(putBytes)).not.toHaveBeenCalled();
	});

	it('422s a corrupt zip', async () => {
		mockHappyPath();
		const res = await postZip(new File([strToU8('not a zip')], 'bad.zip'), await sessionCookie(7));
		expect(res.status).toBe(422);
		expect(vi.mocked(putBytes)).not.toHaveBeenCalled();
	});

	it('502s when the zip cannot be stored and never inserts', async () => {
		mockHappyPath();
		vi.mocked(putBytes).mockResolvedValue({ success: false, error: 'r2 put failed (500)' });
		const res = await postZip(new File([ZIP_BYTES], 'demo.zip'), await sessionCookie(7));
		expect(res.status).toBe(502);
		expect(vi.mocked(createSubmission)).not.toHaveBeenCalled();
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

describe('GET /submissions/:id/validation', () => {
	const runningJob: ValidationJobRow = {
		id: 55,
		submissionId: 1,
		state: 'running',
		progress: [
			{ key: 'fetch', label: 'Fetch source snapshot', state: 'ok' },
			{ key: 'structure', label: 'Check package structure', state: 'running' },
		],
		bullJobId: 'bull-1',
		error: null,
		startedAt: new Date('2026-07-07T09:00:00Z'),
		finishedAt: null,
		createdAt: new Date('2026-07-07T09:00:00Z'),
	};

	it('401s without a session', async () => {
		const res = await app.request('/submissions/1/validation');
		expect(res.status).toBe(401);
	});

	it("404s another user's submission before any job lookup", async () => {
		vi.mocked(findById).mockResolvedValue(userRow);
		vi.mocked(findSubmissionForUser).mockResolvedValue(undefined);
		const res = await app.request('/submissions/2/validation', {
			headers: { Cookie: await sessionCookie(7) },
		});
		expect(res.status).toBe(404);
		expect(vi.mocked(findValidationJobForSubmission)).not.toHaveBeenCalled();
	});

	it('returns a running job with its progress rows', async () => {
		vi.mocked(findById).mockResolvedValue(userRow);
		vi.mocked(findSubmissionForUser).mockResolvedValue({ ...submissionRow, status: 'validating' });
		vi.mocked(findValidationJobForSubmission).mockResolvedValue(runningJob);
		vi.mocked(findValidationReportForSubmission).mockResolvedValue(undefined);
		const res = await app.request('/submissions/1/validation', {
			headers: { Cookie: await sessionCookie(7) },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			success: true,
			data: {
				job: { state: 'running', progress: runningJob.progress, error: null },
				submissionStatus: 'validating',
				report: null,
			},
		});
	});

	it('returns job: null when the job row never landed', async () => {
		vi.mocked(findById).mockResolvedValue(userRow);
		vi.mocked(findSubmissionForUser).mockResolvedValue(submissionRow);
		vi.mocked(findValidationJobForSubmission).mockResolvedValue(undefined);
		vi.mocked(findValidationReportForSubmission).mockResolvedValue(undefined);
		const res = await app.request('/submissions/1/validation', {
			headers: { Cookie: await sessionCookie(7) },
		});
		expect(await res.json()).toEqual({
			success: true,
			data: { job: null, submissionStatus: 'draft', report: null },
		});
	});

	it('exposes findings to the owner but keeps internal report fields off the wire', async () => {
		vi.mocked(findById).mockResolvedValue(userRow);
		vi.mocked(findSubmissionForUser).mockResolvedValue({ ...submissionRow, status: 'failed' });
		vi.mocked(findValidationJobForSubmission).mockResolvedValue({
			...runningJob,
			state: 'done',
			finishedAt: new Date('2026-07-07T09:00:10Z'),
		});
		vi.mocked(findValidationReportForSubmission).mockResolvedValue({
			id: 9,
			submissionId: 1,
			status: 'failed',
			riskLevel: 'low',
			sourceHash: 'sha256:abc',
			engineVersion: '0.1.0',
			report: {
				schemaVersion: '0.1',
				status: 'failed',
				riskLevel: 'low',
				sourceHash: 'sha256:abc',
				engineVersion: '0.1.0',
				permissionsDeclared: [],
				permissionsDetected: [],
				warnings: [],
				failures: [
					{ code: 'secret-pattern', message: 'contains an AWS access key id' },
				],
				createdAt: '2026-07-07T09:00:10.000Z',
			},
			createdAt: new Date('2026-07-07T09:00:10Z'),
		});
		const res = await app.request('/submissions/1/validation', {
			headers: { Cookie: await sessionCookie(7) },
		});
		const body = (await res.json()) as { data: { report: unknown } };
		expect(body.data.report).toEqual({
			status: 'failed',
			riskLevel: 'low',
			warnings: [],
			failures: [{ code: 'secret-pattern', message: 'contains an AWS access key id' }],
		});
		expect(JSON.stringify(body)).not.toContain('sourceHash');
		expect(JSON.stringify(body)).not.toContain('engineVersion');
		expect(JSON.stringify(body)).not.toContain('permissions');
	});
});
