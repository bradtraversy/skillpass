import {
	PERMISSIONS,
	type PermissionKey,
	type PublicPreflight,
	type PublicSkillDetail,
	type ReportFinding,
	type ValidationReport,
	type ValidationStatus,
} from 'skill-schema';
import type { LoadedPackage } from 'validator';
import { originLabel, type UnlistedOrigin } from './receipts';
import { PLAIN, type Styler } from './style';

export function statusLabel(status: ValidationStatus): string {
	return { passed: 'PASSED', warning: 'WARNING', failed: 'FAILED' }[status];
}

export function statusColor(st: Styler, status: ValidationStatus): (text: string) => string {
	return { passed: st.green, warning: st.yellow, failed: st.red }[status];
}

export function riskColor(st: Styler, risk: string): (text: string) => string {
	if (risk === 'low') return st.green;
	if (risk === 'medium') return st.yellow;
	return st.red;
}

export function permissionLine(key: PermissionKey): string {
	const definition = PERMISSIONS.find((p) => p.key === key);
	return definition ? `${key} - ${definition.label}` : key;
}

export function renderPermissions(declared: PermissionKey[], detected: PermissionKey[]): string[] {
	const lines = ['Permissions'];
	const section = (title: string, keys: PermissionKey[]) => {
		lines.push(`  ${title}:`);
		if (keys.length === 0) {
			lines.push('    (none)');
			return;
		}
		for (const key of keys) {
			lines.push(`    ${permissionLine(key)}`);
		}
	};
	section('declared', declared);
	section('detected', detected);
	return lines;
}

export function findingLine(finding: ReportFinding): string {
	const location = finding.location
		? ` [${finding.location.path}${finding.location.line ? `:${finding.location.line}` : ''}]`
		: '';
	return `  ${finding.code}${location} ${finding.message}`;
}

export function renderFindings(title: string, findings: ReportFinding[]): string[] {
	if (findings.length === 0) {
		return [];
	}
	return [`${title} (${findings.length})`, ...findings.map(findingLine)];
}

export function renderPreflightReport(
	detail: PublicSkillDetail,
	preflight: PublicPreflight,
	st: Styler = PLAIN,
): string[] {
	const attribution = detail.attributedTo ? ` (curated from ${detail.attributedTo})` : '';
	const members = detail.packMembers ?? [];
	const verified = preflight.sourceVerified ? st.green('(verified)') : st.red('(HASH MISMATCH)');
	const lines = [
		`Skill     ${st.bold(detail.name)} by ${detail.maintainer}${attribution}`,
		...(members.length > 0 ? [`Pack      ${members.length} skills: ${members.map((m) => m.name).join(', ')}`] : []),
		`Version   ${preflight.version}`,
		`Status    ${statusColor(st, preflight.validationStatus)(statusLabel(preflight.validationStatus))}`,
		`Risk      ${riskColor(st, preflight.riskLevel)(preflight.riskLevel)}`,
		`Source    ${preflight.sourceHash} ${verified}`,
		`Generated ${preflight.generatedAt.slice(0, 10)}`,
		'',
		...renderPermissions(preflight.permissions.declared, preflight.permissions.detected),
		'',
		...renderDiff(preflight.diff),
	];
	if (preflight.blocked) {
		lines.push('', st.red(`BLOCKED: ${preflight.blockedReason ?? 'this version cannot be downloaded'}`));
	}
	return lines;
}

function renderDiff(diff: PublicPreflight['diff']): string[] {
	if (!diff) {
		return ['Changes  first published version - nothing to compare'];
	}
	const added = [...new Set([...diff.declared.added, ...diff.detected.added])];
	const removed = [...new Set([...diff.declared.removed, ...diff.detected.removed])];
	if (added.length === 0 && removed.length === 0) {
		return [`Changes  no permission changes since v${diff.previousVersion}`];
	}
	return [
		`Changes since v${diff.previousVersion}`,
		...added.map((key) => `  + ${key} (new)`),
		...removed.map((key) => `  - ${key} (no longer requested)`),
	];
}

export const LOCAL_BLOCKED_REASON = 'validation failed; failed skills cannot be installed';

// The pre-flight for a repo validated on this machine: the hosted layout, plus
// where it came from and a plain unlisted marker. No diff, nothing to compare.
export function renderLocalPreflight(
	name: string,
	origin: UnlistedOrigin,
	pkg: LoadedPackage,
	report: ValidationReport,
	st: Styler = PLAIN,
): string[] {
	const manifest = pkg.manifest.state === 'ok' ? pkg.manifest.data : undefined;
	const members = manifest?.skills ?? [];
	const lines = [
		`Skill     ${st.bold(name)} ${st.yellow('(unlisted - validated locally, not on the directory)')}`,
		...(members.length > 0 ? [`Pack      ${members.length} skills: ${members.map((m) => m.name).join(', ')}`] : []),
		`Repo      github.com/${originLabel(origin)}`,
		`Commit    ${origin.commit}`,
		`Version   ${manifest?.version ?? 'none declared'}`,
		`Status    ${statusColor(st, report.status)(statusLabel(report.status))}`,
		`Risk      ${riskColor(st, report.riskLevel)(report.riskLevel)}`,
		`Source    ${report.sourceHash} ${st.green('(validated locally)')}`,
		`Engine    ${report.engineVersion}`,
		`Validated ${report.createdAt.slice(0, 10)}`,
		'',
		...renderPermissions(report.permissionsDeclared, report.permissionsDetected),
		'',
		'Changes   not tracked for unlisted installs',
	];
	const failures = renderFindings('Failures', report.failures);
	const warnings = renderFindings('Warnings', report.warnings);
	if (failures.length > 0) lines.push('', ...failures);
	if (warnings.length > 0) lines.push('', ...warnings);
	if (report.status === 'failed') lines.push('', st.red(`BLOCKED: ${LOCAL_BLOCKED_REASON}`));
	return lines;
}
