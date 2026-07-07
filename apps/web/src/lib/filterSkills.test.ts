import type { PublicSkillSummary } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { filterSkills, type SkillFilters } from './filterSkills';

const base: SkillFilters = { query: '', verdict: 'all', tool: 'all' };

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

	it('combines query and verdict (AND semantics)', () => {
		expect(filterSkills(sample, { ...base, query: 'writer', verdict: 'passed' })).toHaveLength(1);
		expect(filterSkills(sample, { ...base, query: 'writer', verdict: 'failed' })).toHaveLength(0);
	});

	it('returns an empty array when nothing matches', () => {
		expect(filterSkills(sample, { ...base, query: 'nonexistent-xyz' })).toEqual([]);
	});
});
