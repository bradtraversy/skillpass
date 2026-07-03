import { z } from 'zod';
import { riskLevelSchema, validationStatusSchema } from './enums';
import { permissionKeySchema } from './permissions';
import { parseWith, type ParseResult } from './result';

export const reportFindingSchema = z.strictObject({
	code: z.string().min(1),
	message: z.string().min(1),
	location: z
		.strictObject({
			path: z.string().min(1),
			line: z.number().int().positive().optional(),
			snippet: z.string().optional(),
		})
		.optional(),
});

export const validationReportSchema = z
	.strictObject({
		schemaVersion: z.literal('0.1'),
		status: validationStatusSchema,
		riskLevel: riskLevelSchema,
		sourceHash: z.string().min(1),
		engineVersion: z.string().min(1),
		permissionsDeclared: z.array(permissionKeySchema),
		permissionsDetected: z.array(permissionKeySchema),
		warnings: z.array(reportFindingSchema),
		failures: z.array(reportFindingSchema),
		createdAt: z.iso.datetime(),
	})
	.superRefine((report, ctx) => {
		const expected =
			report.failures.length > 0 ? 'failed' : report.warnings.length > 0 ? 'warning' : 'passed';
		if (report.status !== expected) {
			ctx.addIssue({
				code: 'custom',
				path: ['status'],
				message: `status "${report.status}" is inconsistent with ${report.failures.length} failure(s) and ${report.warnings.length} warning(s); expected "${expected}"`,
			});
		}
	});

export type ReportFinding = z.infer<typeof reportFindingSchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;

export function parseReport(input: unknown): ParseResult<ValidationReport> {
	return parseWith(validationReportSchema, input);
}
