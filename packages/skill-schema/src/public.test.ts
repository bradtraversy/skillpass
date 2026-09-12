import { describe, expect, it } from 'vitest';
import {
	publicSkillDetailSchema,
	publicSkillListSchema,
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

describe('publicSkillListSchema', () => {
	it('parses an array of summaries and rejects a bad row', () => {
		expect(publicSkillListSchema.parse([summary])).toEqual([summary]);
		expect(publicSkillListSchema.safeParse([{ ...summary, slug: '' }]).success).toBe(false);
	});
});

describe('publicSkillSummarySchema', () => {
	it('parses a valid summary', () => {
		expect(publicSkillSummarySchema.parse(summary)).toEqual(summary);
	});

	it('accepts an attributed listing', () => {
		const attributed = { ...summary, attributedTo: 'octocat' };
		expect(publicSkillSummarySchema.parse(attributed).attributedTo).toBe('octocat');
	});

	it('strips extra keys so older clients survive additive fields', () => {
		const parsed = publicSkillSummarySchema.safeParse({ ...summary, snapshotKey: 'x' });
		expect(parsed.success).toBe(true);
		expect(parsed.success && 'snapshotKey' in parsed.data).toBe(false);
	});

	it('rejects an unknown target', () => {
		expect(publicSkillSummarySchema.safeParse({ ...summary, targets: ['notepad'] }).success).toBe(false);
	});

	it('parses with a category, a null category, and none at all', () => {
		expect(publicSkillSummarySchema.parse({ ...summary, category: 'security-review' }).category).toBe(
			'security-review',
		);
		expect(publicSkillSummarySchema.parse({ ...summary, category: null }).category).toBeNull();
		expect(publicSkillSummarySchema.parse(summary).category).toBeUndefined();
	});

	it('rejects an out-of-taxonomy category', () => {
		expect(publicSkillSummarySchema.safeParse({ ...summary, category: 'hacking' }).success).toBe(false);
	});

	it('parses display copy present, null, and absent', () => {
		const copy = { ...summary, displayName: 'Zeroize Audit', tagline: 'Finds unwiped secrets.' };
		const parsed = publicSkillSummarySchema.parse(copy);
		expect(parsed.displayName).toBe('Zeroize Audit');
		expect(parsed.tagline).toBe('Finds unwiped secrets.');
		expect(publicSkillSummarySchema.parse({ ...summary, displayName: null }).displayName).toBeNull();
		expect(publicSkillSummarySchema.parse(summary).displayName).toBeUndefined();
		expect(publicSkillSummarySchema.parse(summary).tagline).toBeUndefined();
	});

	it('rejects an empty display name or tagline', () => {
		expect(publicSkillSummarySchema.safeParse({ ...summary, displayName: '' }).success).toBe(false);
		expect(publicSkillSummarySchema.safeParse({ ...summary, tagline: '' }).success).toBe(false);
	});

	it('parses integrations as a list, empty, null, and absent', () => {
		expect(publicSkillSummarySchema.parse({ ...summary, integrations: ['obsidian', 'github'] }).integrations).toEqual([
			'obsidian',
			'github',
		]);
		expect(publicSkillSummarySchema.parse({ ...summary, integrations: [] }).integrations).toEqual([]);
		expect(publicSkillSummarySchema.parse({ ...summary, integrations: null }).integrations).toBeNull();
		expect(publicSkillSummarySchema.parse(summary).integrations).toBeUndefined();
	});

	it('rejects a list containing an unknown integration', () => {
		expect(publicSkillSummarySchema.safeParse({ ...summary, integrations: ['obsidian', 'vscode'] }).success).toBe(
			false,
		);
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

	it('strips extra keys on version rows', () => {
		const widened = {
			...detail,
			versions: [{ ...detail.versions[0], snapshotKey: 'x' }],
		};
		const parsed = publicSkillDetailSchema.safeParse(widened);
		expect(parsed.success).toBe(true);
		expect(parsed.success && 'snapshotKey' in parsed.data.versions[0]).toBe(false);
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

	it('strips extra keys on files', () => {
		const widened = {
			version: '1.0.0',
			sourceHash: 'sha256:abc',
			files: [{ path: 'SKILL.md', content: '', snapshotKey: 'x' }],
		};
		const parsed = publicSkillSourceSchema.safeParse(widened);
		expect(parsed.success).toBe(true);
		expect(parsed.success && 'snapshotKey' in parsed.data.files[0]).toBe(false);
	});
});
