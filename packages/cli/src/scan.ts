import { PackageReadError, validatePackage } from 'validator';
import { renderFindings, renderPermissions, statusLabel } from './render';

export interface CommandResult {
	lines: string[];
	exitCode: number;
	// True when the command already printed its lines itself (interactive add).
	streamed?: boolean;
}

// Exit codes are contract: 0 passed/warning, 1 failed, 2 unreadable package.
export async function runScan(path: string, opts: { json?: boolean } = {}): Promise<CommandResult> {
	let report;
	try {
		report = await validatePackage(path);
	} catch (err) {
		if (err instanceof PackageReadError) {
			return { lines: [`error: could not read a skill package at ${path}`], exitCode: 2 };
		}
		throw err;
	}

	if (opts.json) {
		return { lines: [JSON.stringify(report, null, 2)], exitCode: report.status === 'failed' ? 1 : 0 };
	}

	const lines = [
		`Package  ${path}`,
		`Status   ${statusLabel(report.status)}`,
		`Risk     ${report.riskLevel}`,
		`Source   ${report.sourceHash}`,
		`Engine   ${report.engineVersion}`,
		'',
		...renderPermissions(report.permissionsDeclared, report.permissionsDetected),
	];
	const failures = renderFindings('Failures', report.failures);
	const warnings = renderFindings('Warnings', report.warnings);
	if (failures.length > 0) {
		lines.push('', ...failures);
	}
	if (warnings.length > 0) {
		lines.push('', ...warnings);
	}
	if (failures.length === 0 && warnings.length === 0) {
		lines.push('', 'No findings.');
	}

	return { lines, exitCode: report.status === 'failed' ? 1 : 0 };
}
