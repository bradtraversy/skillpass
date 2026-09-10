import type { RiskLevel } from 'skill-schema';

export const RISK_DOT: Record<RiskLevel, string> = {
	low: 'bg-risk-low',
	medium: 'bg-risk-med',
	high: 'bg-risk-high',
	critical: 'bg-risk-crit',
};
