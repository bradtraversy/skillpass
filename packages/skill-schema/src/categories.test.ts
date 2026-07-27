import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_SLUGS, categorySlugSchema } from './categories';

describe('categorySlugSchema', () => {
	it('accepts every taxonomy slug', () => {
		for (const slug of CATEGORY_SLUGS) {
			expect(categorySlugSchema.parse(slug)).toBe(slug);
		}
	});

	it('rejects unknown slugs', () => {
		expect(categorySlugSchema.safeParse('malware').success).toBe(false);
		expect(categorySlugSchema.safeParse('').success).toBe(false);
	});
});

describe('CATEGORIES', () => {
	it('covers every slug exactly once', () => {
		expect(CATEGORIES.map((c) => c.slug).sort()).toEqual([...CATEGORY_SLUGS].sort());
		expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
	});

	it('has a nonempty label and description per category', () => {
		for (const category of CATEGORIES) {
			expect(category.label.length).toBeGreaterThan(0);
			expect(category.description.length).toBeGreaterThan(0);
		}
	});
});
