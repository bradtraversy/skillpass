import { describe, expect, it } from 'vitest';
import { SEED_LISTINGS, seedListingSchema, seedManifestSchema } from './listings';

describe('seedListingSchema', () => {
	it('accepts a valid listing', () => {
		const parsed = seedListingSchema.safeParse({
			githubUrl: 'https://github.com/anthropics/skills/tree/main/skills/pdf',
			attributedTo: 'anthropics',
			featured: true,
		});
		expect(parsed.success).toBe(true);
	});

	it('accepts a listing without the optional featured flag', () => {
		const parsed = seedListingSchema.safeParse({
			githubUrl: 'https://github.com/owner/repo',
			attributedTo: 'owner',
		});
		expect(parsed.success).toBe(true);
	});

	it('rejects a missing githubUrl', () => {
		expect(seedListingSchema.safeParse({ attributedTo: 'anthropics' }).success).toBe(false);
	});

	it('rejects a non-URL githubUrl', () => {
		expect(
			seedListingSchema.safeParse({ githubUrl: 'not-a-url', attributedTo: 'anthropics' }).success,
		).toBe(false);
	});

	it('rejects a non-string attributedTo', () => {
		expect(
			seedListingSchema.safeParse({
				githubUrl: 'https://github.com/owner/repo',
				attributedTo: 123,
			}).success,
		).toBe(false);
	});
});

describe('SEED_LISTINGS', () => {
	it('is a valid manifest of the 17 Anthropic skills', () => {
		expect(seedManifestSchema.safeParse(SEED_LISTINGS).success).toBe(true);
		expect(SEED_LISTINGS).toHaveLength(17);
	});

	it('attributes every entry to anthropics via a subpath URL', () => {
		for (const l of SEED_LISTINGS) {
			expect(l.attributedTo).toBe('anthropics');
			expect(l.githubUrl).toMatch(
				/^https:\/\/github\.com\/anthropics\/skills\/tree\/main\/skills\/[a-z-]+$/,
			);
		}
	});

	it('marks the chosen standouts as featured', () => {
		const featured = SEED_LISTINGS.filter((l) => l.featured).map((l) =>
			l.githubUrl.split('/').pop(),
		);
		expect(featured.sort()).toEqual(['mcp-builder', 'pdf', 'skill-creator']);
	});
});
