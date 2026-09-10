import type { PublicSkillSummary } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { facetCounts } from './facets';

const skill = (overrides: Partial<PublicSkillSummary>): PublicSkillSummary => ({
	slug: 'x',
	name: 'x',
	summary: 'x',
	targets: ['claude-code'],
	validationStatus: 'passed',
	riskLevel: 'low',
	version: '1.0.0',
	maintainer: 'm',
	attributedTo: null,
	featured: false,
	verified: false,
	publishedAt: '2026-07-07T18:24:19.337Z',
	...overrides,
});

describe('facetCounts', () => {
	it('counts categories with a bucket for unclassified listings', () => {
		const { categories } = facetCounts([
			skill({ category: 'dev-tooling' }),
			skill({ category: 'dev-tooling' }),
			skill({ category: null }),
			skill({}),
		]);
		expect([...categories]).toEqual([
			['dev-tooling', 2],
			['uncategorized', 2],
		]);
	});

	it('counts integrations across listings and ignores null or empty', () => {
		const { integrations } = facetCounts([
			skill({ integrations: ['github', 'redis'] }),
			skill({ integrations: ['github'] }),
			skill({ integrations: null }),
			skill({ integrations: [] }),
		]);
		expect([...integrations]).toEqual([
			['github', 2],
			['redis', 1],
		]);
	});

	it('lists tools once, sorted, and counts packs by member presence', () => {
		const { tools, packs } = facetCounts([
			skill({ targets: ['codex', 'claude-code'], packSkills: ['a', 'b'] }),
			skill({ targets: ['claude-code'], packSkills: [] }),
			skill({ targets: ['cursor'], packSkills: null }),
		]);
		expect(tools).toEqual(['claude-code', 'codex', 'cursor']);
		expect(packs).toBe(1);
	});

	it('is all zeros for an empty directory', () => {
		expect(facetCounts([])).toEqual({ categories: new Map(), integrations: new Map(), tools: [], packs: 0 });
	});
});
