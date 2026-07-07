import { parsePassport, type SkillPassport } from 'skill-schema';
import type { SubmissionRow, ValidationReportRow } from '../db/schema';

// Maps from the jsonb report document (the report of record), not the row's
// denormalized columns; the commit sha comes from the submission (github only).
export function buildPassport(
	report: ValidationReportRow,
	submission: SubmissionRow,
	opts: { now?: Date } = {},
): SkillPassport {
	const doc = report.report;
	const passport: SkillPassport = {
		schemaVersion: '0.1',
		validationStatus: doc.status,
		riskLevel: doc.riskLevel,
		permissionsSummary: {
			declared: doc.permissionsDeclared,
			detected: doc.permissionsDetected,
		},
		warningsSummary: doc.warnings,
		sourceHash: doc.sourceHash,
		...(submission.resolvedCommitSha ? { resolvedCommitSha: submission.resolvedCommitSha } : {}),
		engineVersion: doc.engineVersion,
		generatedAt: (opts.now ?? new Date()).toISOString(),
	};

	const parsed = parsePassport(passport);
	if (!parsed.success) {
		throw new Error(`built passport failed the schema self-check: ${parsed.error}`);
	}
	return parsed.data;
}
