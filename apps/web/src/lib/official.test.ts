import type { PublicSkillSummary } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { groupOfficial, OFFICIAL_OWNERS } from './official';

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
		verified: true,
		publishedAt: '2026-07-07T18:00:00.000Z',
		...overrides,
	};
}

describe('OFFICIAL_OWNERS', () => {
	it('has unique logins once lowercased', () => {
		const logins = OFFICIAL_OWNERS.map((owner) => owner.login.toLowerCase());
		expect(new Set(logins).size).toBe(logins.length);
	});

	it('names every owner', () => {
		for (const owner of OFFICIAL_OWNERS) {
			expect(owner.login.trim()).not.toBe('');
			expect(owner.name.trim()).not.toBe('');
		}
	});
});

describe('groupOfficial', () => {
	it('returns nothing for an empty list', () => {
		expect(groupOfficial([])).toEqual([]);
	});

	it('counts verified skills under their official owner', () => {
		const groups = groupOfficial([
			summary({ slug: 'pdf', attributedTo: 'anthropics' }),
			summary({ slug: 'docx', attributedTo: 'anthropics' }),
		]);
		expect(groups).toEqual([{ login: 'anthropics', name: 'Anthropic', count: 2 }]);
	});

	it('leaves out unverified skills even from an official owner', () => {
		expect(groupOfficial([summary({ slug: 'pdf', attributedTo: 'anthropics', verified: false })])).toEqual([]);
	});

	it('leaves out verified skills whose owner is not official', () => {
		expect(groupOfficial([summary({ slug: 'tdd', attributedTo: 'mattpocock' })])).toEqual([]);
	});

	it('falls back to the maintainer when nothing is attributed', () => {
		const groups = groupOfficial([summary({ slug: 'payments', attributedTo: null, maintainer: 'stripe' })]);
		expect(groups.map((group) => group.login)).toEqual(['stripe']);
	});

	it('matches owner logins case-insensitively and keeps the canonical login', () => {
		const groups = groupOfficial([
			summary({ slug: 'azure-functions', attributedTo: 'microsoftdocs' }),
			summary({ slug: 'just-scrape', attributedTo: 'scrapegraphai' }),
		]);
		expect(groups.map((group) => group.login)).toEqual(['MicrosoftDocs', 'ScrapeGraphAI']);
	});

	it('omits official owners with no published skills', () => {
		const groups = groupOfficial([summary({ slug: 'pdf', attributedTo: 'anthropics' })]);
		expect(groups.map((group) => group.login)).not.toContain('google');
	});

	it('orders makers by skill count, then by name', () => {
		const groups = groupOfficial([
			summary({ slug: 'v1', attributedTo: 'vercel' }),
			summary({ slug: 'a1', attributedTo: 'anthropics' }),
			summary({ slug: 'a2', attributedTo: 'anthropics' }),
			summary({ slug: 's1', attributedTo: 'stripe' }),
		]);
		expect(groups.map((group) => group.name)).toEqual(['Anthropic', 'Stripe', 'Vercel']);
	});
});
