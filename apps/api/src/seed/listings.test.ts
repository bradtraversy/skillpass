import { describe, expect, it } from 'vitest';
import { FEATURED_SLUGS, SEED_LISTINGS, seedListingSchema, seedManifestSchema } from './listings';

describe('seedListingSchema', () => {
	it('accepts a valid listing', () => {
		const parsed = seedListingSchema.safeParse({
			githubUrl: 'https://github.com/anthropics/skills/tree/main/skills/pdf',
			attributedTo: 'anthropics',
		});
		expect(parsed.success).toBe(true);
	});

	it('accepts the optional name and displayName overrides', () => {
		const parsed = seedListingSchema.safeParse({
			githubUrl: 'https://github.com/owner/repo',
			attributedTo: 'owner',
			name: 'owner-pack',
			displayName: 'Owner Pack',
		});
		expect(parsed.success).toBe(true);
	});

	it('rejects a missing githubUrl', () => {
		expect(seedListingSchema.safeParse({ attributedTo: 'anthropics' }).success).toBe(false);
	});

	it('rejects a non-URL githubUrl', () => {
		expect(seedListingSchema.safeParse({ githubUrl: 'not-a-url', attributedTo: 'anthropics' }).success).toBe(false);
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
	it('is a valid manifest of all ten waves', () => {
		expect(seedManifestSchema.safeParse(SEED_LISTINGS).success).toBe(true);
		expect(SEED_LISTINGS).toHaveLength(591);
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
			addyosmani: 25,
			obra: 14,
			kepano: 5,
			trailofbits: 75,
			blader: 1,
			mvanhorn: 1,
			DietrichGebert: 6,
			OthmanAdi: 1,
			ayghri: 1,
			'vercel-labs': 11,
			googleworkspace: 10,
			makenotion: 1,
			supabase: 2,
			cloudflare: 10,
			expo: 5,
			mattpocock: 35,
			'multica-ai': 1,
			nextlevelbuilder: 2,
			Leonxlnx: 12,
			coreyhaines31: 41,
			AgriciDaniel: 1,
			SawyerHood: 1,
			'browser-act': 2,
			aws: 6,
			google: 13,
			flutter: 5,
			getsentry: 5,
			huggingface: 5,
			openai: 5,
			MicrosoftDocs: 5,
			stripe: 1,
			neondatabase: 1,
			bradtraversy: 2,
			'prime-skills': 30,
			microsoft: 29,
			larksuite: 27,
			JuliusBrussee: 20,
			'remotion-dev': 12,
			emilkowalski: 11,
			lllllllama: 11,
			firebase: 9,
			prisma: 9,
			firecrawl: 12,
			'genmedia-labs': 8,
			'higgsfield-ai': 8,
			greensock: 7,
			autonnel: 6,
			liarjsdev: 4,
			UseOSINT: 4,
			antibrow: 3,
			'get-convex': 3,
			'google-labs-code': 3,
			'momentic-ai': 2,
			wshobson: 2,
			'2dmurali': 1,
			'agentix-cloud': 1,
			arvindrk: 1,
			'better-auth': 1,
			'browser-use': 1,
			'currents-dev': 1,
			'designed-by-ai': 1,
			'flowkit-labs': 1,
			'genkit-ai': 1,
			herdrdev: 1,
			intellectronica: 1,
			jakubkrehel: 1,
			'mastra-ai': 1,
			mcollina: 1,
			msmps: 1,
			'nexscope-ai': 2,
			'nozomio-labs': 1,
			nrwl: 1,
			Nutlope: 1,
			ScrapeGraphAI: 1,
			'shadcn-ui': 1,
			'solana-foundation': 1,
			SpillwaveSolutions: 1,
			squirrelscan: 1,
			'typesafe-ai': 1,
			vercel: 2,
			'Wind-Alice': 1,
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

	it('carries no per-entry featured flags; the roster is FEATURED_SLUGS', () => {
		expect(SEED_LISTINGS.some((l) => 'featured' in l)).toBe(false);
	});
});

describe('FEATURED_SLUGS', () => {
	it('leads with the owner packs and holds twenty unique picks', () => {
		expect(FEATURED_SLUGS.slice(0, 2)).toEqual(['ai-blueprint', 'editorial-workflow-skill']);
		expect(FEATURED_SLUGS).toHaveLength(20);
		expect(new Set(FEATURED_SLUGS).size).toBe(FEATURED_SLUGS.length);
	});
});
