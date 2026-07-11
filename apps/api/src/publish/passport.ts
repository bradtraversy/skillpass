import { parsePassport, type Distribution, type SkillPassport } from 'skill-schema';
import type { SubmissionRow, ValidationReportRow } from '../db/schema';

// How the listing is obtained + whether its manifest was inferred; carried from
// the loaded manifest so the passport (and the detail-page CTA) stay honest.
export interface PassportManifest {
	distribution: Distribution;
	homepage?: string;
	install?: string;
	inferred: boolean;
}

// Maps from the jsonb report document (the report of record), not the row's
// denormalized columns; the commit sha comes from the submission (github only).
export function buildPassport(
	report: ValidationReportRow,
	submission: SubmissionRow,
	manifest: PassportManifest,
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
		distribution: manifest.distribution,
		...(manifest.homepage ? { homepage: manifest.homepage } : {}),
		...(manifest.install ? { install: manifest.install } : {}),
		manifestInferred: manifest.inferred,
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
