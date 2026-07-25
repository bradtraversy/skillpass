import { riskWeightOf, type PermissionKey, type RiskLevel } from 'skill-schema';

// Maps a permission to a risk level by its taxonomy weight, for the passport's
// per-permission chip. Lives in the web bundle, which must not import server code;
// a taxonomy-level home for these thresholds is a future option.
export function permissionLevel(key: PermissionKey): RiskLevel {
	const weight = riskWeightOf(key);
	if (weight >= 9) return 'critical';
	if (weight >= 7) return 'high';
	if (weight >= 4) return 'medium';
	return 'low';
}
