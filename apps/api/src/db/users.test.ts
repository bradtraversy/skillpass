import { describe, expect, it } from 'vitest';
import { publicUser } from './users';
import type { UserRow } from './schema';

const row: UserRow = {
	id: 7,
	githubId: '12345',
	username: 'bradtraversy',
	displayName: 'Brad Traversy',
	avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
	role: 'maintainer',
	reputation: 0,
	createdAt: new Date('2026-07-04T10:00:00Z'),
};

describe('publicUser', () => {
	it('maps the row to the public shape with an ISO date', () => {
		expect(publicUser(row)).toEqual({
			id: 7,
			username: 'bradtraversy',
			displayName: 'Brad Traversy',
			avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
			role: 'maintainer',
			reputation: 0,
			createdAt: '2026-07-04T10:00:00.000Z',
		});
	});

	it('never exposes the githubId', () => {
		expect(publicUser(row)).not.toHaveProperty('githubId');
	});
});
