import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { Db } from '../db/client';
import type { UserRow } from '../db/schema';
import { loadEnv } from '../env';
import { RAW_TEST_ENV } from '../testing/env';
import { exchangeCode, fetchGithubUser } from '../auth/github';
import { findById, upsertFromGithub } from '../db/users';

vi.mock('../auth/github', async (importOriginal) => ({
	...(await importOriginal<typeof import('../auth/github')>()),
	exchangeCode: vi.fn(),
	fetchGithubUser: vi.fn(),
}));

vi.mock('../db/users', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/users')>()),
	upsertFromGithub: vi.fn(),
	findById: vi.fn(),
}));

const env = loadEnv({ ...RAW_TEST_ENV, WEB_ORIGIN: 'http://localhost:4321' });

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

const app = createApp(env, {} as Db);

function mockHappyGithub() {
	vi.mocked(exchangeCode).mockResolvedValue({ success: true, data: 'gho_token' });
	vi.mocked(fetchGithubUser).mockResolvedValue({
		success: true,
		data: {
			githubId: '12345',
			username: 'bradtraversy',
			displayName: 'Brad Traversy',
			avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
		},
	});
	vi.mocked(upsertFromGithub).mockResolvedValue(userRow);
}

async function happyCallback(): Promise<Response> {
	mockHappyGithub();
	return app.request('/auth/github/callback?code=abc&state=xyz', {
		headers: { Cookie: 'oauth_state=xyz' },
	});
}

function sessionCookieFrom(res: Response): string {
	const setCookies = res.headers.getSetCookie();
	const session = setCookies.find(
		(c) => c.startsWith('aiskills_session=') && !c.includes('Max-Age=0'),
	);
	expect(session).toBeDefined();
	return (session as string).split(';')[0];
}

beforeEach(() => vi.clearAllMocks());

describe('GET /auth/github', () => {
	it('redirects to github with a state cookie', async () => {
		const res = await app.request('/auth/github');
		expect(res.status).toBe(302);
		const location = new URL(res.headers.get('location') as string);
		expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
		expect(location.searchParams.get('client_id')).toBe('client-id');
		const state = location.searchParams.get('state');
		expect(res.headers.getSetCookie().join(';')).toContain(`oauth_state=${state}`);
	});
});

describe('GET /auth/github/callback', () => {
	it('sets a signed session cookie and redirects home on success', async () => {
		const res = await happyCallback();
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('http://localhost:4321');
		const cookie = sessionCookieFrom(res);
		expect(cookie).toMatch(/^aiskills_session=7\./); // user id + dot + signature
		expect(vi.mocked(upsertFromGithub)).toHaveBeenCalledOnce();
	});

	it('rejects a mismatched state with 403 and no session', async () => {
		mockHappyGithub();
		const res = await app.request('/auth/github/callback?code=abc&state=WRONG', {
			headers: { Cookie: 'oauth_state=xyz' },
		});
		expect(res.status).toBe(403);
		expect(res.headers.getSetCookie().join(';')).not.toContain('aiskills_session=7');
		expect(vi.mocked(exchangeCode)).not.toHaveBeenCalled();
	});

	it('redirects to ?auth=failed when the user denies consent', async () => {
		const res = await app.request('/auth/github/callback?error=access_denied', {
			headers: { Cookie: 'oauth_state=xyz' },
		});
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('http://localhost:4321/?auth=failed');
	});

	it('redirects to ?auth=failed when the code exchange fails', async () => {
		vi.mocked(exchangeCode).mockResolvedValue({ success: false, error: 'boom' });
		const res = await app.request('/auth/github/callback?code=stale&state=xyz', {
			headers: { Cookie: 'oauth_state=xyz' },
		});
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('http://localhost:4321/?auth=failed');
		expect(vi.mocked(upsertFromGithub)).not.toHaveBeenCalled();
	});
});

describe('GET /me', () => {
	it('401s without a session cookie', async () => {
		const res = await app.request('/me');
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ success: false, error: 'unauthorized' });
	});

	it('401s with a tampered cookie', async () => {
		const res = await app.request('/me', {
			headers: { Cookie: 'aiskills_session=7%2Eforged-signature' },
		});
		expect(res.status).toBe(401);
	});

	it('returns the public user with a valid session from the callback', async () => {
		const cookie = sessionCookieFrom(await happyCallback());
		vi.mocked(findById).mockResolvedValue(userRow);
		const res = await app.request('/me', { headers: { Cookie: cookie } });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.data.username).toBe('bradtraversy');
		expect(body.data).not.toHaveProperty('githubId');
		expect(vi.mocked(findById)).toHaveBeenCalledWith(expect.anything(), 7);
	});
});

describe('POST /auth/logout', () => {
	it('clears the session cookie', async () => {
		const res = await app.request('/auth/logout', { method: 'POST' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true, data: { loggedOut: true } });
		const cleared = res.headers.getSetCookie().find((c) => c.startsWith('aiskills_session='));
		expect(cleared).toContain('Max-Age=0'); // expired immediately
	});
});
