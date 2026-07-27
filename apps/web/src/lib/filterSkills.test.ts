import type { PublicSkillSummary } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { filterSkills, type SkillFilters } from './filterSkills';

const base: SkillFilters = {
	query: '',
	verdict: 'all',
	tool: 'all',
	category: 'all',
	integration: 'all',
	tab: 'new',
};

function summary(overrides: Partial<PublicSkillSummary>): PublicSkillSummary {
	return {
		slug: 'skill',
		name: 'Skill',
		summary: 'Does things.',
		targets: ['claude-code'],
		validationStatus: 'passed',
		riskLevel: 'low',
		version: '1.0.0',
		maintainer: 'someone',
		attributedTo: null,
		featured: false,
		verified: false,
		publishedAt: '2026-07-07T18:00:00.000Z',
		...overrides,
	};
}

const sample: PublicSkillSummary[] = [
	summary({
		slug: 'commit-message-writer',
		name: 'Commit Message Writer',
		summary: 'Writes conventional commit messages from the staged diff.',
		targets: ['codex', 'cursor'],
		maintainer: 'traversymedia',
	}),
	summary({
		slug: 'gmail-sweep',
		name: 'Gmail Sweep',
		summary: 'Weekly inbox triage and labeling.',
		targets: ['cowork'],
		validationStatus: 'warning',
		riskLevel: 'high',
		maintainer: 'inboxlabs',
	}),
	summary({
		slug: 'auto-deploy-runner',
		name: 'Auto Deploy Runner',
		summary: 'Runs build and deploy on merge.',
		targets: ['aider'],
		validationStatus: 'failed',
		riskLevel: 'critical',
		maintainer: 'shipfast',
	}),
];

describe('filterSkills', () => {
	it('returns everything with no filters applied', () => {
		expect(filterSkills(sample, base)).toHaveLength(3);
	});

	it('matches the query against the name, case-insensitively', () => {
		const result = filterSkills(sample, { ...base, query: 'GMAIL' });
		expect(result.map((s) => s.slug)).toEqual(['gmail-sweep']);
	});

	it('matches the query against maintainer and target tools', () => {
		expect(filterSkills(sample, { ...base, query: 'shipfast' })).toHaveLength(1);
		expect(filterSkills(sample, { ...base, query: 'cowork' })).toHaveLength(1);
	});

	it('trims surrounding whitespace from the query', () => {
		expect(filterSkills(sample, { ...base, query: '  gmail  ' })).toHaveLength(1);
	});

	it('filters by verdict', () => {
		const result = filterSkills(sample, { ...base, verdict: 'passed' });
		expect(result.map((s) => s.slug)).toEqual(['commit-message-writer']);
	});

	it('filters by tool', () => {
		const result = filterSkills(sample, { ...base, tool: 'aider' });
		expect(result.map((s) => s.slug)).toEqual(['auto-deploy-runner']);
	});

	it('filters by category', () => {
		const skills = [
			summary({ slug: 'fuzzer', category: 'fuzzing' }),
			summary({ slug: 'reviewer', category: 'security-review' }),
		];
		expect(filterSkills(skills, { ...base, category: 'fuzzing' }).map((s) => s.slug)).toEqual([
			'fuzzer',
		]);
		expect(filterSkills(skills, base)).toHaveLength(2);
	});

	it('uncategorized matches null and absent categories only', () => {
		const skills = [
			summary({ slug: 'tagged', category: 'testing' }),
			summary({ slug: 'null-cat', category: null }),
			summary({ slug: 'absent-cat' }),
		];
		const result = filterSkills(skills, { ...base, category: 'uncategorized' });
		expect(result.map((s) => s.slug).sort()).toEqual(['absent-cat', 'null-cat']);
	});

	it('combines query and verdict (AND semantics)', () => {
		expect(filterSkills(sample, { ...base, query: 'writer', verdict: 'passed' })).toHaveLength(1);
		expect(filterSkills(sample, { ...base, query: 'writer', verdict: 'failed' })).toHaveLength(0);
	});

	it('returns an empty array when nothing matches', () => {
		expect(filterSkills(sample, { ...base, query: 'nonexistent-xyz' })).toEqual([]);
	});
});

describe('filterSkills tabs', () => {
	const a = summary({ slug: 'a', name: 'Alpha', featured: true, verified: false, publishedAt: '2026-01-01T00:00:00.000Z' });
	const b = summary({ slug: 'b', name: 'Bravo', featured: false, verified: true, publishedAt: '2026-03-01T00:00:00.000Z' });
	const c = summary({ slug: 'c', name: 'Charlie', featured: true, verified: true, publishedAt: '2026-02-01T00:00:00.000Z' });
	const skills = [a, b, c];

	it('new: returns all, newest first', () => {
		expect(filterSkills(skills, { ...base, tab: 'new' }).map((s) => s.slug)).toEqual(['b', 'c', 'a']);
	});

	it('featured: only featured skills, newest first', () => {
		expect(filterSkills(skills, { ...base, tab: 'featured' }).map((s) => s.slug)).toEqual(['c', 'a']);
	});

	it('verified: only verified skills, newest first', () => {
		expect(filterSkills(skills, { ...base, tab: 'verified' }).map((s) => s.slug)).toEqual(['b', 'c']);
	});

	it('featured falls back to all (newest first) when nothing is featured', () => {
		const none = [
			summary({ slug: 'x', featured: false, publishedAt: '2026-01-01T00:00:00.000Z' }),
			summary({ slug: 'y', featured: false, publishedAt: '2026-02-01T00:00:00.000Z' }),
		];
		expect(filterSkills(none, { ...base, tab: 'featured' }).map((s) => s.slug)).toEqual(['y', 'x']);
	});

	it('composes the tab with the text query', () => {
		expect(filterSkills(skills, { ...base, tab: 'verified', query: 'bravo' }).map((s) => s.slug)).toEqual([
			'b',
		]);
	});
});

describe('integration filter', () => {
	const skills = [
		summary({ slug: 'vault-notes', integrations: ['obsidian'] }),
		summary({ slug: 'pr-bot', integrations: ['github', 'slack'] }),
		summary({ slug: 'classified-none', integrations: [] }),
		summary({ slug: 'never-classified', integrations: null }),
		summary({ slug: 'absent-field' }),
	];

	it('matches skills whose list contains the selected integration', () => {
		expect(filterSkills(skills, { ...base, integration: 'github' }).map((s) => s.slug)).toEqual([
			'pr-bot',
		]);
	});

	it('passes everything through on all', () => {
		expect(filterSkills(skills, { ...base, integration: 'all' })).toHaveLength(5);
	});

	it('excludes none, null, and absent integrations from a slug filter', () => {
		const result = filterSkills(skills, { ...base, integration: 'obsidian' }).map((s) => s.slug);
		expect(result).toEqual(['vault-notes']);
	});

	it('ANDs with the category filter', () => {
		const mixed = [
			summary({ slug: 'match', category: 'knowledge-notes', integrations: ['obsidian'] }),
			summary({ slug: 'wrong-category', category: 'fuzzing', integrations: ['obsidian'] }),
			summary({ slug: 'wrong-integration', category: 'knowledge-notes', integrations: [] }),
		];
		expect(
			filterSkills(mixed, { ...base, category: 'knowledge-notes', integration: 'obsidian' }).map(
				(s) => s.slug,
			),
		).toEqual(['match']);
	});
});
