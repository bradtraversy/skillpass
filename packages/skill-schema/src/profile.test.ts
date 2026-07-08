import { describe, expect, it } from 'vitest';
import { publicProfileSchema, type PublicProfile } from './profile';

const profile: PublicProfile = {
	username: 'bradtraversy',
	displayName: 'Brad Traversy',
	avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
	reputation: 12,
	joinedAt: '2026-07-04T10:00:00.000Z',
	skills: [
		{
			slug: 'smoke-clean',
			name: 'smoke-clean',
			summary: 'Clean smoke-test skill.',
			targets: ['claude-code'],
			validationStatus: 'passed',
			riskLevel: 'low',
			version: '1.0.0',
			maintainer: 'bradtraversy',
			attributedTo: null,
			publishedAt: '2026-07-07T18:24:19.337Z',
		},
	],
};

describe('publicProfileSchema', () => {
	it('parses a valid profile', () => {
		expect(publicProfileSchema.parse(profile)).toEqual(profile);
	});

	it('accepts an empty skills list', () => {
		expect(publicProfileSchema.parse({ ...profile, skills: [] }).skills).toEqual([]);
	});

	it('rejects extra keys like githubId or role', () => {
		expect(publicProfileSchema.safeParse({ ...profile, githubId: '123' }).success).toBe(false);
		expect(publicProfileSchema.safeParse({ ...profile, role: 'admin' }).success).toBe(false);
	});

	it('rejects a malformed skill row', () => {
		const broken = { ...profile, skills: [{ ...profile.skills[0], snapshotKey: 'x' }] };
		expect(publicProfileSchema.safeParse(broken).success).toBe(false);
	});
});
