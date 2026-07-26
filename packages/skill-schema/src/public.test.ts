import { describe, expect, it } from 'vitest';
import {
	publicSkillDetailSchema,
	publicSkillSourceSchema,
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
	featured: false,
	verified: false,
	publishedAt: '2026-07-07T18:24:19.337Z',
};

const detail: PublicSkillDetail = {
	...summary,
	githubRepoUrl: null,
	passport: {
		schemaVersion: '0.1',
		validationStatus: 'passed',
		riskLevel: 'low',
		permissionsSummary: { declared: [], detected: ['network.fetch'] },
		warningsSummary: [],
		distribution: 'skill',
		manifestInferred: false,
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
	aiReview: null,
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

describe('publicSkillSourceSchema', () => {
	it('parses a snapshot source and allows empty file content', () => {
		const source = {
			version: '1.0.0',
			sourceHash: 'sha256:abc',
			files: [
				{ path: 'SKILL.md', content: '# hi' },
				{ path: 'empty.txt', content: '' },
			],
		};
		expect(publicSkillSourceSchema.parse(source)).toEqual(source);
	});

	it('rejects extra keys on files', () => {
		const broken = {
			version: '1.0.0',
			sourceHash: 'sha256:abc',
			files: [{ path: 'SKILL.md', content: '', snapshotKey: 'x' }],
		};
		expect(publicSkillSourceSchema.safeParse(broken).success).toBe(false);
	});
});
