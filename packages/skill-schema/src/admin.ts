import { z } from 'zod';
import { abuseReportStatusSchema } from './abuse';
import { riskLevelSchema, validationStatusSchema } from './enums';
import { reportFindingSchema } from './report';
import { parseWith, type ParseResult } from './result';
import { submissionSourceTypeSchema, submissionStatusSchema } from './submission';

// Admin-only wire shapes. Unlike the public report contract these carry ids and
// cross-references, so the holding queue can act on each row.

export const adminAbuseReportSchema = z.strictObject({
	id: z.number().int().positive(),
	reason: z.string(),
	status: abuseReportStatusSchema,
	createdAt: z.iso.datetime(),
	skill: z.strictObject({ slug: z.string(), name: z.string() }),
	reporter: z.strictObject({ username: z.string() }),
});

const findingsSummarySchema = z.strictObject({
	status: validationStatusSchema,
	riskLevel: riskLevelSchema,
	warnings: z.array(reportFindingSchema),
	failures: z.array(reportFindingSchema),
});

export const adminSubmissionSchema = z.strictObject({
	id: z.number().int().positive(),
	sourceType: submissionSourceTypeSchema,
	githubUrl: z.string().nullable(),
	status: submissionStatusSchema,
	createdAt: z.iso.datetime(),
	user: z.strictObject({ username: z.string() }),
	report: findingsSummarySchema.nullable(),
});

export const adminSkillRefSchema = z.strictObject({
	slug: z.string(),
	name: z.string(),
	maintainer: z.strictObject({ username: z.string() }),
});

export const adminQueueSchema = z.strictObject({
	reports: z.array(adminAbuseReportSchema),
	failedSubmissions: z.array(adminSubmissionSchema),
	flaggedSkills: z.array(adminSkillRefSchema),
});

export const adminVersionHistorySchema = z.strictObject({
	version: z.string(),
	publishedAt: z.iso.datetime().nullable(),
	validationStatus: validationStatusSchema,
	riskLevel: riskLevelSchema,
	warnings: z.array(reportFindingSchema),
	failures: z.array(reportFindingSchema),
	sourceHash: z.string(),
	resolvedCommitSha: z.string().nullable(),
});

// Resolve accepts the two terminal statuses only; 'open' is the initial state,
// never a resolve target.
export const resolveReportInputSchema = z.strictObject({
	status: z.enum(['reviewed', 'actioned']),
});

export type AdminAbuseReport = z.infer<typeof adminAbuseReportSchema>;
export type AdminSubmission = z.infer<typeof adminSubmissionSchema>;
export type AdminSkillRef = z.infer<typeof adminSkillRefSchema>;
export type AdminQueue = z.infer<typeof adminQueueSchema>;
export type AdminVersionHistory = z.infer<typeof adminVersionHistorySchema>;
export type ResolveReportInput = z.infer<typeof resolveReportInputSchema>;

export function parseResolveReportInput(input: unknown): ParseResult<ResolveReportInput> {
	return parseWith(resolveReportInputSchema, input);
}
