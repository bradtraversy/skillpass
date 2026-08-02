import { z } from 'zod';
import { abuseReportStatusSchema } from './abuse';
import { riskLevelSchema, validationStatusSchema } from './enums';
import { parseWith, type ParseResult } from './result';

// Maintainer-dashboard wire shapes: what GET /me/skills and GET /me/reports
// return. Reports deliberately omit the reporter - maintainers never see who
// filed a report.

export const SKILL_STATUSES = ['published', 'draft', 'private', 'flagged'] as const;
export const skillStatusSchema = z.enum(SKILL_STATUSES);
export type SkillStatus = z.infer<typeof skillStatusSchema>;

export const maintainerSkillSchema = z.strictObject({
	slug: z.string().min(1),
	name: z.string().min(1),
	status: skillStatusSchema,
	version: z.string().nullable(),
	validationStatus: validationStatusSchema.nullable(),
	riskLevel: riskLevelSchema.nullable(),
	updatedAt: z.iso.datetime(),
});

export type MaintainerSkill = z.infer<typeof maintainerSkillSchema>;

export const maintainerReportSchema = z.strictObject({
	id: z.number().int().positive(),
	skill: z.strictObject({ slug: z.string(), name: z.string() }),
	reason: z.string(),
	status: abuseReportStatusSchema,
	createdAt: z.iso.datetime(),
});

export type MaintainerReport = z.infer<typeof maintainerReportSchema>;

export function parseMaintainerSkill(input: unknown): ParseResult<MaintainerSkill> {
	return parseWith(maintainerSkillSchema, input);
}

export function parseMaintainerReport(input: unknown): ParseResult<MaintainerReport> {
	return parseWith(maintainerReportSchema, input);
}
