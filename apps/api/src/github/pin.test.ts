import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../env';
import { RAW_TEST_ENV } from '../testing/env';
import { resolveCommit } from './pin';

const env = loadEnv(RAW_TEST_ENV);

function mockFetch(response: { status?: number; json?: unknown; reject?: Error; headers?: Record<string, string> }) {
	const fn = vi.fn().mockImplementation(() => {
		if (response.reject) return Promise.reject(response.reject);
		const status = response.status ?? 200;
		return Promise.resolve({
			ok: status >= 200 && status < 300,
			status,
			headers: new Headers(response.headers ?? {}),
			json: () => Promise.resolve(response.json),
		});
	});
	vi.stubGlobal('fetch', fn);
	return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('resolveCommit', () => {
	it('resolves HEAD for a target without a ref', async () => {
		const fn = mockFetch({ json: { sha: 'abc123' } });
		const result = await resolveCommit(env, { owner: 'octocat', repo: 'hello' });
		expect(result).toEqual({ success: true, data: 'abc123' });
		const [url, init] = fn.mock.calls[0];
		expect(url).toBe('https://api.github.com/repos/octocat/hello/commits/HEAD');
		expect(init.headers['User-Agent']).toBe('skillpass');
		expect(init.headers.Authorization).toBeUndefined();
	});

	it('resolves the given ref and sends the token when configured', async () => {
		const fn = mockFetch({ json: { sha: 'def456' } });
		const withToken = loadEnv({ ...RAW_TEST_ENV, GITHUB_TOKEN: 'ghp_test' });
		const result = await resolveCommit(withToken, { owner: 'octocat', repo: 'hello', ref: 'v1.0' });
		expect(result).toEqual({ success: true, data: 'def456' });
		const [url, init] = fn.mock.calls[0];
		expect(url).toBe('https://api.github.com/repos/octocat/hello/commits/v1.0');
		expect(init.headers.Authorization).toBe('Bearer ghp_test');
	});

	it.each([
		[404, 'not-found'],
		[429, 'rate-limited'],
		[500, 'upstream'],
	] as const)('maps a %i to %s', async (status, code) => {
		mockFetch({ status, json: {} });
		const result = await resolveCommit(env, { owner: 'octocat', repo: 'hello' });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.code).toBe(code);
		}
	});

	it('maps a 403 with an exhausted quota to rate-limited', async () => {
		mockFetch({ status: 403, json: {}, headers: { 'x-ratelimit-remaining': '0' } });
		const result = await resolveCommit(env, { owner: 'octocat', repo: 'hello' });
		expect(result).toMatchObject({ success: false, code: 'rate-limited' });
	});

	it('maps a non-quota 403 to upstream, not rate-limited', async () => {
		mockFetch({ status: 403, json: {}, headers: { 'x-ratelimit-remaining': '4999' } });
		const result = await resolveCommit(env, { owner: 'octocat', repo: 'hello' });
		expect(result).toMatchObject({ success: false, code: 'upstream' });
	});

	it('maps a network failure to upstream', async () => {
		mockFetch({ reject: new Error('socket hang up') });
		const result = await resolveCommit(env, { owner: 'octocat', repo: 'hello' });
		expect(result).toMatchObject({ success: false, code: 'upstream' });
	});

	it('maps a missing sha in the response to upstream', async () => {
		mockFetch({ json: { message: 'weird' } });
		const result = await resolveCommit(env, { owner: 'octocat', repo: 'hello' });
		expect(result).toMatchObject({ success: false, code: 'upstream' });
	});
});
