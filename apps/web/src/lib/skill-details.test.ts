import { describe, expect, it } from 'vitest';
import { detailSlugs, getSkillDetail, skillSlugs } from './skill-details';

// Guards getStaticPaths: a skill with no detail entry would build a broken page,
// and an orphan detail is dead fixture data. Both must stay in lockstep.
describe('skillDetails integrity', () => {
	it('has exactly one detail entry per seeded skill', () => {
		expect([...detailSlugs].sort()).toEqual([...skillSlugs].sort());
	});

	it('has no duplicate detail slugs', () => {
		expect(new Set(detailSlugs).size).toBe(detailSlugs.length);
	});

	it('resolves every seeded slug through getSkillDetail', () => {
		for (const slug of skillSlugs) {
			expect(getSkillDetail(slug)?.slug).toBe(slug);
		}
	});

	it('returns undefined for an unknown slug', () => {
		expect(getSkillDetail('does-not-exist')).toBeUndefined();
	});
});
