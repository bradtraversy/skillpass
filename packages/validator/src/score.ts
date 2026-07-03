import { riskWeightOf, type PermissionKey, type RiskLevel } from 'skill-schema';

// Risk is derived from permissions only (declared + detected), never from
// findings - status and risk are independent axes by design.
export function riskLevelFor(keys: Iterable<PermissionKey>): RiskLevel {
	let max = 0;
	for (const key of keys) {
		max = Math.max(max, riskWeightOf(key));
	}
	if (max >= 9) return 'critical';
	if (max >= 7) return 'high';
	if (max >= 4) return 'medium';
	return 'low';
}
