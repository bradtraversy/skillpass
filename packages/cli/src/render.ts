import {
	PERMISSIONS,
	type PermissionKey,
	type PublicPreflight,
	type ReportFinding,
	type ValidationStatus,
} from 'skill-schema';

export function statusLabel(status: ValidationStatus): string {
	return { passed: 'PASSED', warning: 'WARNING', failed: 'FAILED' }[status];
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

export function renderDiff(diff: PublicPreflight['diff']): string[] {
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
