import type { PublicSkillSummary } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { filterSkills, matchesFilters, type SkillFilters } from './filterSkills';

const base: SkillFilters = {
	query: '',
	tool: 'all',
	category: 'all',
	integration: 'all',
	type: 'all',
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

const withPack: PublicSkillSummary[] = [
	...sample,
	summary({
		slug: 'ai-blueprint',
		name: 'AI Blueprint',
		summary: 'Spec-driven workflow pack.',
		packSkills: ['onboard', 'feature', 'implement'],
	}),
];

describe('filterSkills type filter', () => {
	it('pack keeps only listings with members', () => {
		const out = filterSkills(withPack, { ...base, type: 'pack' });
		expect(out.map((s) => s.slug)).toEqual(['ai-blueprint']);
	});

	it('skill excludes packs', () => {
		const out = filterSkills(withPack, { ...base, type: 'skill' });
		expect(out.map((s) => s.slug)).not.toContain('ai-blueprint');
		expect(out).toHaveLength(3);
	});

	it('searches pack member names', () => {
		const out = filterSkills(withPack, { ...base, query: 'implement' });
		expect(out.map((s) => s.slug)).toEqual(['ai-blueprint']);
	});
});

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

	it('returns an empty array when nothing matches', () => {
		expect(filterSkills(sample, { ...base, query: 'nonexistent-xyz' })).toEqual([]);
	});
});

describe('filterSkills tabs', () => {
	// Input mirrors the API's curated directory order: ranked featured first
	// (a then c), non-featured after, regardless of publish date.
	const a = summary({ slug: 'a', name: 'Alpha', featured: true, verified: false, publishedAt: '2026-01-01T00:00:00.000Z' });
	const c = summary({ slug: 'c', name: 'Charlie', featured: true, verified: true, publishedAt: '2026-02-01T00:00:00.000Z' });
	const b = summary({ slug: 'b', name: 'Bravo', featured: false, verified: true, publishedAt: '2026-03-01T00:00:00.000Z' });
	const skills = [a, c, b];

	it('featured: only featured skills, preserving curated input order', () => {
		expect(filterSkills(skills, { ...base, tab: 'featured' }).map((s) => s.slug)).toEqual(['a', 'c']);
	});

	it('featured falls back to everything in input order when nothing is featured', () => {
		const none = [
			summary({ slug: 'y', featured: false, publishedAt: '2026-02-01T00:00:00.000Z' }),
			summary({ slug: 'x', featured: false, publishedAt: '2026-01-01T00:00:00.000Z' }),
		];
		expect(filterSkills(none, { ...base, tab: 'featured' }).map((s) => s.slug)).toEqual(['y', 'x']);
	});

	it('new: pure newest-first, ignoring featured', () => {
		expect(filterSkills(skills, { ...base, tab: 'new' }).map((s) => s.slug)).toEqual(['b', 'c', 'a']);
	});

	it('an active query overrides the tab and spans the whole catalog', () => {
		const out = filterSkills(skills, { ...base, tab: 'featured', query: 'bravo' });
		expect(out.map((s) => s.slug)).toEqual(['b']);
	});

	it('query results keep directory order across featured and non-featured', () => {
		const out = filterSkills(skills, { ...base, tab: 'new', query: 'a' });
		expect(out.map((s) => s.slug)).toEqual(['a', 'c', 'b']);
	});

	it('sidebar filters stay tab-scoped', () => {
		const out = filterSkills(skills, { ...base, tab: 'featured', type: 'skill' });
		expect(out.map((s) => s.slug)).toEqual(['a', 'c']);
	});
});

describe('matchesFilters', () => {
	const fields: Omit<SkillFilters, 'query' | 'tab'> = {
		tool: 'all',
		category: 'all',
		integration: 'all',
		type: 'all',
	};

	it('applies the sidebar facets without query or tab', () => {
		const skill = summary({ slug: 's', validationStatus: 'warning', targets: ['codex'] });
		expect(matchesFilters(skill, fields)).toBe(true);
		expect(matchesFilters(skill, { ...fields, tool: 'codex' })).toBe(true);
		expect(matchesFilters(skill, { ...fields, tool: 'aider' })).toBe(false);
	});

	it('filters a pre-ranked list while preserving its order', () => {
		const ranked = [
			summary({ slug: 'best', category: 'dev-tooling' }),
			summary({ slug: 'other', category: 'fuzzing' }),
			summary({ slug: 'second-best', category: 'dev-tooling' }),
		];
		const filtered = ranked.filter((s) => matchesFilters(s, { ...fields, category: 'dev-tooling' }));
		expect(filtered.map((s) => s.slug)).toEqual(['best', 'second-best']);
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
