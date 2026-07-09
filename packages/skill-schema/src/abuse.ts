import { z } from 'zod';
import { parseWith, type ParseResult } from './result';

export const ABUSE_REPORT_STATUSES = ['open', 'reviewed', 'actioned'] as const;
export const abuseReportStatusSchema = z.enum(ABUSE_REPORT_STATUSES);
export type AbuseReportStatus = z.infer<typeof abuseReportStatusSchema>;

export const ABUSE_REASON_MIN = 10;
export const ABUSE_REASON_MAX = 1000;

// What POST /skills/:slug/report accepts.
export const abuseReportInputSchema = z.strictObject({
	reason: z
		.string()
		.trim()
		.min(ABUSE_REASON_MIN, `tell us what's wrong in at least ${ABUSE_REASON_MIN} characters`)
		.max(ABUSE_REASON_MAX, `keep the reason under ${ABUSE_REASON_MAX} characters`),
});

// The reporter's confirmation - deliberately minimal, no ids, no echo.
export const publicAbuseReportSchema = z.strictObject({
	status: abuseReportStatusSchema,
	createdAt: z.iso.datetime(),
});

export type AbuseReportInput = z.infer<typeof abuseReportInputSchema>;
export type PublicAbuseReport = z.infer<typeof publicAbuseReportSchema>;

export function parseAbuseReportInput(input: unknown): ParseResult<AbuseReportInput> {
	return parseWith(abuseReportInputSchema, input);
}
