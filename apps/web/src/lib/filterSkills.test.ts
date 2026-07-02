import { describe, expect, it } from 'vitest';
import { filterSkills, type SkillFilters } from './filterSkills';
import type { Skill } from './skills';

const base: SkillFilters = { query: '', verdict: 'all', tool: 'all' };

const sample: Skill[] = [
	{
		slug: 'commit-message-writer',
		name: 'Commit Message Writer',
		summary: 'Writes conventional commit messages from the staged diff.',
		targets: ['codex', 'cursor'],
		verdict: 'passed',
		riskLevel: 'low',
		category: 'Git',
		tags: ['git', 'commits'],
		maintainer: 'traversymedia',
		installs: 5900,
		lastValidated: '1d ago',
	},
	{
		slug: 'gmail-sweep',
		name: 'Gmail Sweep',
		summary: 'Weekly inbox triage and labeling.',
		targets: ['cowork'],
		verdict: 'warning',
		riskLevel: 'high',
		category: 'Productivity',
		tags: ['email', 'gmail'],
		maintainer: 'inboxlabs',
		installs: 870,
		lastValidated: 'review',
	},
	{
		slug: 'auto-deploy-runner',
		name: 'Auto Deploy Runner',
		summary: 'Runs build and deploy on merge.',
		targets: ['aider'],
		verdict: 'failed',
		riskLevel: 'critical',
		category: 'Deployment',
		tags: ['deploy', 'ci'],
		maintainer: 'shipfast',
		installs: 0,
		lastValidated: 'blocked',
	},
];

describe('filterSkills', () => {
	it('returns everything with no filters applied', () => {
		expect(filterSkills(sample, base)).toHaveLength(3);
	});

	it('matches the query against the name, case-insensitively', () => {
		const result = filterSkills(sample, { ...base, query: 'GMAIL' });
		expect(result.map((s) => s.slug)).toEqual(['gmail-sweep']);
	});

	it('matches the query against maintainer, tags, and tools', () => {
		expect(filterSkills(sample, { ...base, query: 'shipfast' })).toHaveLength(1); // maintainer
		expect(filterSkills(sample, { ...base, query: 'commits' })).toHaveLength(1); // tag
		expect(filterSkills(sample, { ...base, query: 'cowork' })).toHaveLength(1); // target tool
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
