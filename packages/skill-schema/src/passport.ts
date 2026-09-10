import { z } from 'zod';
import { riskLevelSchema, validationStatusSchema } from './enums';
import { distributionSchema } from './manifest';
import { permissionKeySchema } from './permissions';
import { reportFindingSchema } from './report';
import { parseWith, type ParseResult } from './result';

export const skillPassportSchema = z.object({
	schemaVersion: z.literal('0.1'),
	validationStatus: validationStatusSchema,
	riskLevel: riskLevelSchema,
	permissionsSummary: z.object({
		declared: z.array(permissionKeySchema),
		detected: z.array(permissionKeySchema),
	}),
	warningsSummary: z.array(reportFindingSchema),
	// How the listing is obtained; drives the detail-page CTA.
	distribution: distributionSchema,
	homepage: z.url().optional(),
	install: z.string().min(1).optional(),
	// True when the manifest was synthesized from a bare SKILL.md, so the
	// permissions were inferred from content rather than author-declared.
	manifestInferred: z.boolean(),
	sourceHash: z.string().min(1),
	resolvedCommitSha: z.string().min(1).optional(),
	engineVersion: z.string().min(1),
	generatedAt: z.iso.datetime(),
	signature: z.string().min(1).optional(),
});

export type SkillPassport = z.infer<typeof skillPassportSchema>;

export function parsePassport(input: unknown): ParseResult<SkillPassport> {
	return parseWith(skillPassportSchema, input);
}
