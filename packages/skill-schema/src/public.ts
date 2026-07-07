import { z } from 'zod';
import { riskLevelSchema, targetSchema, validationStatusSchema } from './enums';
import { skillPassportSchema } from './passport';

// What GET /skills returns per row; 7c pages and the CLI consume it.
export const publicSkillSummarySchema = z.strictObject({
	slug: z.string().min(1),
	name: z.string().min(1),
	summary: z.string().min(1),
	targets: z.array(targetSchema),
	validationStatus: validationStatusSchema,
	riskLevel: riskLevelSchema,
	version: z.string().min(1),
	maintainer: z.string().min(1),
	attributedTo: z.string().min(1).nullable(),
	publishedAt: z.iso.datetime(),
});

export const publicSkillVersionSchema = z.strictObject({
	version: z.string().min(1),
	validationStatus: validationStatusSchema,
	riskLevel: riskLevelSchema,
	publishedAt: z.iso.datetime(),
});

// What GET /skills/:slug returns; the passport jsonb travels verbatim. The
// version-pinned GET /skills/:slug/:version returns the same shape with
// version/passport/status fields from the requested version.
export const publicSkillDetailSchema = publicSkillSummarySchema.extend({
	githubRepoUrl: z.string().min(1).nullable(),
	passport: skillPassportSchema,
	maintainerInfo: z.strictObject({
		username: z.string().min(1),
		displayName: z.string().min(1),
		avatarUrl: z.string().min(1),
	}),
	versions: z.array(publicSkillVersionSchema),
});

// What GET /skills/:slug/:version/source returns - the pinned snapshot the
// validator saw, verbatim; feature 8 and the CLI read the same object.
export const publicSkillSourceSchema = z.strictObject({
	version: z.string().min(1),
	sourceHash: z.string().min(1),
	files: z.array(z.strictObject({ path: z.string().min(1), content: z.string() })),
});

export type PublicSkillSummary = z.infer<typeof publicSkillSummarySchema>;
export type PublicSkillVersion = z.infer<typeof publicSkillVersionSchema>;
export type PublicSkillDetail = z.infer<typeof publicSkillDetailSchema>;
export type PublicSkillSource = z.infer<typeof publicSkillSourceSchema>;
