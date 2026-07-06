import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserRow } from '../db/schema';
import { loadEnv } from '../env';
import { RAW_TEST_ENV } from '../testing/env';
import { verifySubmitPermission } from './ownership';

const env = loadEnv(RAW_TEST_ENV);

const maintainer: UserRow = {
	id: 7,
	githubId: '12345',
	username: 'BradTraversy',
	displayName: 'Brad Traversy',
	avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
	role: 'maintainer',
	reputation: 0,
	createdAt: new Date('2026-07-04T10:00:00Z'),
};

function mockFetch(response: { status?: number; reject?: Error; headers?: Record<string, string> }) {
	const fn = vi.fn().mockImplementation(() => {
		if (response.reject) return Promise.reject(response.reject);
		const status = response.status ?? 204;
		return Promise.resolve({
			ok: status >= 200 && status < 300,
			status,
			headers: new Headers(response.headers ?? {}),
		});
	});
	vi.stubGlobal('fetch', fn);
	return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('verifySubmitPermission', () => {
	it('lets an admin submit any repo without calling github', async () => {
		const fn = mockFetch({});
		const admin = { ...maintainer, role: 'admin' as const };
		const result = await verifySubmitPermission(env, admin, { owner: 'octocat', repo: 'hello' });
		expect(result).toEqual({ success: true, data: null });
		expect(fn).not.toHaveBeenCalled();
	});

	it('matches the repo owner case-insensitively without calling github', async () => {
		const fn = mockFetch({});
		const result = await verifySubmitPermission(env, maintainer, {
			owner: 'bradtraversy',
			repo: 'dotfiles',
		});
		expect(result).toEqual({ success: true, data: null });
		expect(fn).not.toHaveBeenCalled();
	});

	it('allows a public org member via the membership endpoint', async () => {
		const fn = mockFetch({ status: 204 });
		const result = await verifySubmitPermission(env, maintainer, {
			owner: 'traversy-media',
			repo: 'skills',
		});
		expect(result).toEqual({ success: true, data: null });
		expect(fn.mock.calls[0][0]).toBe(
			'https://api.github.com/orgs/traversy-media/public_members/BradTraversy',
		);
	});

	it("forbids someone else's repo (org 404)", async () => {
		mockFetch({ status: 404 });
		const result = await verifySubmitPermission(env, maintainer, {
			owner: 'octocat',
			repo: 'hello',
		});
		expect(result).toMatchObject({ success: false, code: 'forbidden' });
	});

	it('maps quota exhaustion to rate-limited', async () => {
		mockFetch({ status: 403, headers: { 'x-ratelimit-remaining': '0' } });
		const result = await verifySubmitPermission(env, maintainer, {
			owner: 'octocat',
			repo: 'hello',
		});
		expect(result).toMatchObject({ success: false, code: 'rate-limited' });
	});

	it('maps a network failure to upstream', async () => {
		mockFetch({ reject: new Error('socket hang up') });
		const result = await verifySubmitPermission(env, maintainer, {
			owner: 'octocat',
			repo: 'hello',
		});
		expect(result).toMatchObject({ success: false, code: 'upstream' });
	});
});
