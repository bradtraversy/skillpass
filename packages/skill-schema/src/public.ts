import { z } from 'zod';
import { aiReviewSchema } from './ai-review';
import { categorySlugSchema } from './categories';
import { riskLevelSchema, targetSchema, validationStatusSchema } from './enums';
import { integrationSlugSchema } from './integrations';
import { skillEntrySchema } from './manifest';
import { skillPassportSchema } from './passport';

// What GET /skills returns per row; 7c pages and the CLI consume it. Read
// contracts strip unknown keys so an installed CLI survives additive API fields.
export const publicSkillSummarySchema = z.object({
	slug: z.string().min(1),
	name: z.string().min(1),
	summary: z.string().min(1),
	targets: z.array(targetSchema),
	validationStatus: validationStatusSchema,
	riskLevel: riskLevelSchema,
	// Count of advisory findings ("things to pay attention to"); the listing shows
	// it instead of a pass/warn verdict. Optional so older consumers still parse.
	noteCount: z.number().int().nonnegative().optional(),
	// Fixed-taxonomy browse category; null until classified. Optional so clients
	// still parse responses from an API predating categories.
	category: categorySlugSchema.nullable().optional(),
	// Human display copy generated at publish/backfill; null until generated,
	// optional for the same deploy-skew reason as category.
	displayName: z.string().min(1).nullable().optional(),
	tagline: z.string().min(1).nullable().optional(),
	// Works-with facet; null = never classified, [] = classified as none.
	integrations: z.array(integrationSlugSchema).nullable().optional(),
	// Member skill names when the listing is a multi-skill pack; null for a
	// single skill. Optional so clients parse responses from an older API.
	packSkills: z.array(z.string().min(1)).nullable().optional(),
	version: z.string().min(1),
	maintainer: z.string().min(1),
	attributedTo: z.string().min(1).nullable(),
	featured: z.boolean(),
	verified: z.boolean(),
	publishedAt: z.iso.datetime(),
});

export const publicSkillListSchema = z.array(publicSkillSummarySchema);

export const publicSkillVersionSchema = z.object({
	version: z.string().min(1),
	validationStatus: validationStatusSchema,
	riskLevel: riskLevelSchema,
	publishedAt: z.iso.datetime(),
});

// What GET /skills/:slug returns; the passport jsonb travels verbatim. The
// version-pinned GET /skills/:slug/:version returns the same shape with
// version/passport/status fields from the requested version.
export const publicSkillDetailSchema = publicSkillSummarySchema.extend({
	// Full member entries (incl. per-target variants) for a pack; the CLI's
	// per-target install resolution reads exactly this. Null for single skills.
	packMembers: z.array(z.object(skillEntrySchema.shape)).nullable().optional(),
	githubRepoUrl: z.string().min(1).nullable(),
	passport: skillPassportSchema,
	maintainerInfo: z.object({
		username: z.string().min(1),
		displayName: z.string().min(1),
		avatarUrl: z.string().min(1),
	}),
	versions: z.array(publicSkillVersionSchema),
	// The cached AI review for this version's source hash; null until generated.
	aiReview: aiReviewSchema.nullable(),
});

// What GET /skills/:slug/:version/source returns - the pinned snapshot the
// validator saw, verbatim; feature 8 and the CLI read the same object.
export const publicSkillSourceSchema = z.object({
	version: z.string().min(1),
	sourceHash: z.string().min(1),
	files: z.array(z.object({ path: z.string().min(1), content: z.string() })),
});

export type PublicSkillSummary = z.infer<typeof publicSkillSummarySchema>;
export type PublicSkillVersion = z.infer<typeof publicSkillVersionSchema>;
export type PublicSkillDetail = z.infer<typeof publicSkillDetailSchema>;
export type PublicSkillSource = z.infer<typeof publicSkillSourceSchema>;
