import { validationReportSchema, type ReportFinding, type ValidationReport } from 'skill-schema';
import { loadPackage } from './load';
import { contentRule } from './rules/content';
import { detectPermissions, permissionsRule } from './rules/permissions';
import { structureRule } from './rules/structure';
import type { RuleFinding } from './rules/types';
import { riskLevelFor } from './score';

// Bump together with package.json when the rule set changes.
export const ENGINE_VERSION = '0.1.0';

const RULES = [structureRule, contentRule, permissionsRule];

function toReportFindings(findings: RuleFinding[]): ReportFinding[] {
	return [...findings]
		.sort(
			(a, b) =>
				(a.location?.path ?? '').localeCompare(b.location?.path ?? '') ||
				a.code.localeCompare(b.code) ||
				(a.location?.line ?? 0) - (b.location?.line ?? 0),
		)
		.map(({ severity: _severity, ...finding }) => finding);
}

export async function validatePackage(
	dir: string,
	opts: { now?: Date } = {},
): Promise<ValidationReport> {
	const pkg = loadPackage(dir);
	const all = RULES.flatMap((rule) => rule(pkg));

	const declared = pkg.manifest.state === 'ok' ? pkg.manifest.data.permissions : [];
	const detected = detectPermissions(pkg)
		.map((d) => d.permission)
		.sort();

	const report: ValidationReport = {
		schemaVersion: '0.1',
		status: all.some((f) => f.severity === 'failure')
			? 'failed'
			: all.some((f) => f.severity === 'warning')
				? 'warning'
				: 'passed',
		riskLevel: riskLevelFor([...declared, ...detected]),
		sourceHash: pkg.sourceHash,
		engineVersion: ENGINE_VERSION,
		permissionsDeclared: declared,
		permissionsDetected: detected,
		warnings: toReportFindings(all.filter((f) => f.severity === 'warning')),
		failures: toReportFindings(all.filter((f) => f.severity === 'failure')),
		createdAt: (opts.now ?? new Date()).toISOString(),
	};

	// Self-check: an inconsistent or malformed report is a validator bug.
	return validationReportSchema.parse(report);
}
