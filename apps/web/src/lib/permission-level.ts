import { riskWeightOf, type PermissionKey, type RiskLevel } from 'skill-schema';

// Same thresholds as the validator's riskLevelFor, duplicated because the web
// bundle must not import the validator. Candidate for a taxonomy-level move.
export function permissionLevel(key: PermissionKey): RiskLevel {
	const weight = riskWeightOf(key);
	if (weight >= 9) return 'critical';
	if (weight >= 7) return 'high';
	if (weight >= 4) return 'medium';
	return 'low';
}
