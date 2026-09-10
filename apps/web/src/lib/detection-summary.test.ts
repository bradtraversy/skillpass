import type { DetectedPackage } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { detectionSummary } from './detection-summary';

const base: DetectedPackage = { skillMd: true, manifest: 'ok', name: 'demo', skillCount: null };

describe('detectionSummary', () => {
	it.each([
		['a pack', { ...base, skillCount: 3 }, 'text-pass', '3-skill pack - will list as "demo"'],
		['a manifest', base, 'text-pass', 'skill.json found - will list as "demo"'],
		['an inferred manifest', { ...base, manifest: 'inferred' as const }, 'text-pass', 'SKILL.md found - will list as "demo"'],
		['an invalid manifest', { ...base, manifest: 'invalid' as const }, 'text-warn', 'skill.json is not valid - validation will flag it'],
		['a missing SKILL.md', { ...base, manifest: 'missing' as const, skillMd: false, name: null }, 'text-warn', 'no SKILL.md at the top level - validation will fail; submit the folder that contains it'],
	])('describes %s', (_label, detected, tone, text) => {
		expect(detectionSummary(detected)).toEqual({ tone, text });
	});
});
