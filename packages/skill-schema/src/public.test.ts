import { describe, expect, it } from 'vitest';
import {
	publicSkillDetailSchema,
	publicSkillSummarySchema,
	type PublicSkillDetail,
	type PublicSkillSummary,
} from './public';

const summary: PublicSkillSummary = {
	slug: 'clean-skill',
	name: 'clean-skill',
	summary: 'A tidy demo skill.',
	targets: ['claude-code'],
	validationStatus: 'passed',
	riskLevel: 'low',
	version: '1.0.0',
	maintainer: 'bradtraversy',
	attributedTo: null,
	publishedAt: '2026-07-07T18:24:19.337Z',
};

const detail: PublicSkillDetail = {
	...summary,
	passport: {
		schemaVersion: '0.1',
		validationStatus: 'passed',
		riskLevel: 'low',
		permissionsSummary: { declared: [], detected: ['network.fetch'] },
		warningsSummary: [],
		sourceHash: 'sha256:abc',
		engineVersion: 'validator-0.1.0',
		generatedAt: '2026-07-07T18:24:19.337Z',
	},
	maintainerInfo: {
		username: 'bradtraversy',
		displayName: 'Brad Traversy',
		avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
	},
	versions: [
		{
			version: '1.0.0',
			validationStatus: 'passed',
			riskLevel: 'low',
			publishedAt: '2026-07-07T18:24:19.337Z',
		},
	],
};

describe('publicSkillSummarySchema', () => {
	it('parses a valid summary', () => {
		expect(publicSkillSummarySchema.parse(summary)).toEqual(summary);
	});

	it('accepts an attributed listing', () => {
		const attributed = { ...summary, attributedTo: 'octocat' };
		expect(publicSkillSummarySchema.parse(attributed).attributedTo).toBe('octocat');
	});

	it('rejects extra keys', () => {
		expect(publicSkillSummarySchema.safeParse({ ...summary, snapshotKey: 'x' }).success).toBe(
			false,
		);
	});

	it('rejects an unknown target', () => {
		expect(
			publicSkillSummarySchema.safeParse({ ...summary, targets: ['notepad'] }).success,
		).toBe(false);
	});
});

describe('publicSkillDetailSchema', () => {
	it('parses a valid detail with passport and versions', () => {
		expect(publicSkillDetailSchema.parse(detail)).toEqual(detail);
	});

	it('rejects a detail whose passport is malformed', () => {
		const broken = { ...detail, passport: { ...detail.passport, sourceHash: '' } };
		expect(publicSkillDetailSchema.safeParse(broken).success).toBe(false);
	});

	it('rejects extra keys on version rows', () => {
		const broken = {
			...detail,
			versions: [{ ...detail.versions[0], snapshotKey: 'x' }],
		};
		expect(publicSkillDetailSchema.safeParse(broken).success).toBe(false);
	});
});
