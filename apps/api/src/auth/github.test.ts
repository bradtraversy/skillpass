import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAuthorizeUrl, exchangeCode, fetchGithubUser } from './github';

function mockFetch(response: { ok?: boolean; status?: number; json?: unknown; reject?: Error }) {
	const fn = vi.fn().mockImplementation(() => {
		if (response.reject) return Promise.reject(response.reject);
		return Promise.resolve({
			ok: response.ok ?? true,
			status: response.status ?? 200,
			json: () => (response.json instanceof Error ? Promise.reject(response.json) : Promise.resolve(response.json)),
		});
	});
	vi.stubGlobal('fetch', fn);
	return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('buildAuthorizeUrl', () => {
	it('points at github with client_id and state', () => {
		const url = new URL(buildAuthorizeUrl('client-123', 'state-456'));
		expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
		expect(url.searchParams.get('client_id')).toBe('client-123');
		expect(url.searchParams.get('state')).toBe('state-456');
	});
});

describe('exchangeCode', () => {
	it('returns the access token on success', async () => {
		const fn = mockFetch({ json: { access_token: 'gho_test', token_type: 'bearer' } });
		const result = await exchangeCode('code', 'id', 'secret');
		expect(result).toEqual({ success: true, data: 'gho_test' });
		const [url, init] = fn.mock.calls[0];
		expect(url).toBe('https://github.com/login/oauth/access_token');
		expect(init.method).toBe('POST');
		expect(init.headers.Accept).toBe('application/json');
	});

	it('fails on github 200-with-error body (bad code)', async () => {
		mockFetch({ json: { error: 'bad_verification_code' } });
		const result = await exchangeCode('stale', 'id', 'secret');
		expect(result.success).toBe(false);
	});

	it('fails on a non-ok status', async () => {
		mockFetch({ ok: false, status: 502 });
		expect((await exchangeCode('code', 'id', 'secret')).success).toBe(false);
	});

	it('fails when fetch throws', async () => {
		mockFetch({ reject: new Error('network down') });
		const result = await exchangeCode('code', 'id', 'secret');
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain('network down');
	});
});

describe('fetchGithubUser', () => {
	const githubUser = {
		id: 12345,
		login: 'bradtraversy',
		name: 'Brad Traversy',
		avatar_url: 'https://avatars.githubusercontent.com/u/12345',
	};

	it('maps the github user to a profile', async () => {
		const fn = mockFetch({ json: githubUser });
		const result = await fetchGithubUser('gho_test');
		expect(result).toEqual({
			success: true,
			data: {
				githubId: '12345',
				username: 'bradtraversy',
				displayName: 'Brad Traversy',
				avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
			},
		});
		const [, init] = fn.mock.calls[0];
		expect(init.headers.Authorization).toBe('Bearer gho_test');
		expect(init.headers['User-Agent']).toBe('skillpass');
	});

	it('falls back to the login when name is null', async () => {
		mockFetch({ json: { ...githubUser, name: null } });
		const result = await fetchGithubUser('gho_test');
		expect(result.success && result.data.displayName).toBe('bradtraversy');
	});

	it('fails on a non-ok status', async () => {
		mockFetch({ ok: false, status: 401 });
		expect((await fetchGithubUser('bad')).success).toBe(false);
	});

	it('fails on an unexpected body shape', async () => {
		mockFetch({ json: { unexpected: true } });
		expect((await fetchGithubUser('gho_test')).success).toBe(false);
	});

	it('fails when the body is not json', async () => {
		mockFetch({ json: new Error('invalid json') });
		expect((await fetchGithubUser('gho_test')).success).toBe(false);
	});
});
