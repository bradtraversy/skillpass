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
	it('is a valid manifest of all nine waves', () => {
		expect(seedManifestSchema.safeParse(SEED_LISTINGS).success).toBe(true);
		expect(SEED_LISTINGS).toHaveLength(242);
	});

	it('carries the expected count per source, each under its attributed owner', () => {
		const counts = new Map<string, number>();
		for (const l of SEED_LISTINGS) {
			counts.set(l.attributedTo, (counts.get(l.attributedTo) ?? 0) + 1);
			// Root-repo skills stop at the repo; folder skills address a subpath.
			expect(l.githubUrl).toMatch(
				new RegExp(
					`^https://github\\.com/${l.attributedTo}/[A-Za-z0-9._-]+(?:/tree/[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+)?$`,
				),
			);
		}
		expect(Object.fromEntries(counts)).toEqual({
			anthropics: 31,
			addyosmani: 24,
			obra: 14,
			kepano: 5,
			trailofbits: 75,
			blader: 1,
			mvanhorn: 1,
			DietrichGebert: 6,
			OthmanAdi: 1,
			ayghri: 1,
			'vercel-labs': 4,
			googleworkspace: 8,
			makenotion: 1,
			supabase: 2,
			cloudflare: 5,
			expo: 4,
			mattpocock: 5,
			'multica-ai': 1,
			nextlevelbuilder: 2,
			Leonxlnx: 1,
			coreyhaines31: 8,
			AgriciDaniel: 1,
			SawyerHood: 1,
			'browser-act': 1,
			aws: 6,
			google: 6,
			flutter: 5,
			getsentry: 5,
			huggingface: 5,
			openai: 5,
			MicrosoftDocs: 5,
			stripe: 1,
			neondatabase: 1,
		});
	});

	it('gives every knowledge-work pack a namespaced name and a Pack card title', () => {
		const packs = SEED_LISTINGS.filter((l) => l.githubUrl.includes('/knowledge-work-plugins/'));
		expect(packs).toHaveLength(14);
		for (const p of packs) {
			expect(p.name).toBe(`knowledge-work-${p.githubUrl.split('/').pop()}`);
			expect(p.displayName).toMatch(/^[A-Z][A-Za-z ]+ Pack$/);
		}
		const sales = packs.find((p) => p.githubUrl.endsWith('/sales'));
		expect(sales?.displayName).toBe('Sales Pack');
	});

	it('has no duplicate source URLs', () => {
		const urls = SEED_LISTINGS.map((l) => l.githubUrl);
		expect(new Set(urls).size).toBe(urls.length);
	});

	it('marks the chosen standouts as featured', () => {
		const featured = SEED_LISTINGS.filter((l) => l.featured).map((l) =>
			l.githubUrl.split('/').pop(),
		);
		expect(featured.sort()).toEqual([
			'humanizer',
			'last30days',
			'mcp-builder',
			'pdf',
			'ponytail',
			'skill-creator',
			'ui-ux-pro-max',
		]);
	});
});
