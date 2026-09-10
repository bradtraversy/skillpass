import { validationReportSchema, type ReportFinding, type ValidationReport } from 'skill-schema';
import { loadPackage, type LoadedPackage } from './load';
import { contentRule } from './rules/content';
import { detectPermissions } from './rules/permissions';
import { structureRule } from './rules/structure';
import type { Rule, RuleFinding } from './rules/types';
import pkg from '../package.json' with { type: 'json' };

// The package version is the engine version: a rule change bumps package.json.
export const ENGINE_VERSION: string = pkg.version;

export interface ValidatorRule {
	key: string;
	label: string;
	run: Rule;
}

// Ordered; stepwise callers (the validation worker) iterate these to report
// per-rule progress, then assemble with buildReport.
export const RULES: ValidatorRule[] = [
	{ key: 'structure', label: 'Check package structure', run: structureRule },
	{ key: 'content', label: 'Scan content for risky patterns', run: contentRule },
];

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

export function buildReport(
	pkg: LoadedPackage,
	findings: RuleFinding[],
	opts: { now?: Date } = {},
): ValidationReport {
	const declared = pkg.manifest.state === 'ok' ? pkg.manifest.data.permissions : [];
	const detected = [...detectPermissions(pkg.files)].sort();

	const status = findings.some((f) => f.severity === 'failure')
		? 'failed'
		: findings.some((f) => f.severity === 'warning')
			? 'warning'
			: 'passed';

	const report: ValidationReport = {
		schemaVersion: '0.1',
		status,
		// Risk follows the verdict so it can never contradict it (no "passed" +
		// "critical"). What the skill *can do* is surfaced separately as detected
		// permissions, not conflated into a danger score.
		riskLevel: status === 'failed' ? 'high' : status === 'warning' ? 'medium' : 'low',
		sourceHash: pkg.sourceHash,
		engineVersion: ENGINE_VERSION,
		permissionsDeclared: declared,
		permissionsDetected: detected,
		warnings: toReportFindings(findings.filter((f) => f.severity === 'warning')),
		failures: toReportFindings(findings.filter((f) => f.severity === 'failure')),
		createdAt: (opts.now ?? new Date()).toISOString(),
	};

	// Self-check: an inconsistent or malformed report is a validator bug.
	return validationReportSchema.parse(report);
}

export async function validateLoadedPackage(
	pkg: LoadedPackage,
	opts: { now?: Date } = {},
): Promise<ValidationReport> {
	return buildReport(
		pkg,
		RULES.flatMap((rule) => rule.run(pkg)),
		opts,
	);
}

export async function validatePackage(
	dir: string,
	opts: { now?: Date } = {},
): Promise<ValidationReport> {
	return validateLoadedPackage(loadPackage(dir), opts);
}
