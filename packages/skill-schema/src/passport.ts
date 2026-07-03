import { z } from 'zod';
import { riskLevelSchema, validationStatusSchema } from './enums';
import { permissionKeySchema } from './permissions';
import { reportFindingSchema } from './report';
import { parseWith, type ParseResult } from './result';

export const skillPassportSchema = z.strictObject({
	schemaVersion: z.literal('0.1'),
	validationStatus: validationStatusSchema,
	riskLevel: riskLevelSchema,
	permissionsSummary: z.strictObject({
		declared: z.array(permissionKeySchema),
		detected: z.array(permissionKeySchema),
	}),
	warningsSummary: z.array(reportFindingSchema),
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
