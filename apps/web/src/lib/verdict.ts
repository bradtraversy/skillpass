import type { Verdict } from './skills';

export interface VerdictTint {
	text: string; // text color only
	border: string; // border color only
	bg: string; // soft background only
	all: string; // combined, for a stamp element that needs all three at once
}

// Verdict -> Tailwind tint classes. Shared so the compact Stamp, the large header
// stamp, and the passport never drift apart. Parts are split so callers can tint a
// single property (a container border, a strip background) without the others.
export const VERDICT_TINT: Record<Verdict, VerdictTint> = {
	passed: {
		text: 'text-pass',
		border: 'border-pass-line',
		bg: 'bg-pass-soft',
		all: 'text-pass border-pass-line bg-pass-soft',
	},
	warning: {
		text: 'text-warn',
		border: 'border-warn-line',
		bg: 'bg-warn-soft',
		all: 'text-warn border-warn-line bg-warn-soft',
	},
	failed: {
		text: 'text-fail',
		border: 'border-fail-line',
		bg: 'bg-fail-soft',
		all: 'text-fail border-fail-line bg-fail-soft',
	},
};
