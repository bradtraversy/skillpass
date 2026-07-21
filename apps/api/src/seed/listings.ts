import { z } from 'zod';

export const seedListingSchema = z.object({
	githubUrl: z.url(),
	attributedTo: z.string().min(1),
	featured: z.boolean().optional(),
});

export type SeedListing = z.infer<typeof seedListingSchema>;

export const seedManifestSchema = z.array(seedListingSchema);

// Wave 1: the 17 official anthropics/skills, each a subfolder addressed by
// subpath. Later waves extend this array; the seed engine doesn't change.
const ANTHROPIC_SKILLS = [
	'algorithmic-art',
	'brand-guidelines',
	'canvas-design',
	'claude-api',
	'doc-coauthoring',
	'docx',
	'frontend-design',
	'internal-comms',
	'mcp-builder',
	'pdf',
	'pptx',
	'skill-creator',
	'slack-gif-creator',
	'theme-factory',
	'web-artifacts-builder',
	'webapp-testing',
	'xlsx',
];

const FEATURED = new Set(['pdf', 'mcp-builder', 'skill-creator']);

export const SEED_LISTINGS: SeedListing[] = seedManifestSchema.parse(
	ANTHROPIC_SKILLS.map((name) => ({
		githubUrl: `https://github.com/anthropics/skills/tree/main/skills/${name}`,
		attributedTo: 'anthropics',
		...(FEATURED.has(name) ? { featured: true } : {}),
	})),
);
