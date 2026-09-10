import { describe, expect, it } from 'vitest';
import { parsePublicUser } from './user';

const user = {
	id: 7,
	username: 'octocat',
	displayName: 'The Octocat',
	avatarUrl: 'https://example.com/a.png',
	role: 'maintainer',
	reputation: 12,
	createdAt: '2026-07-07T18:24:19.337Z',
};

describe('parsePublicUser', () => {
	it('accepts the /me payload', () => {
		expect(parsePublicUser(user)).toEqual({ success: true, data: user });
	});

	it.each([
		['an unknown role', { ...user, role: 'owner' }],
		['a non-ISO createdAt', { ...user, createdAt: 'yesterday' }],
		['a missing username', { ...user, username: undefined }],
	])('rejects %s', (_label, input) => {
		expect(parsePublicUser(input).success).toBe(false);
	});

	it('strips keys the API must not leak, such as githubId', () => {
		const parsed = parsePublicUser({ ...user, githubId: '123' });
		expect(parsed.success && 'githubId' in parsed.data).toBe(false);
	});
});
