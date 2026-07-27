import { describe, expect, it } from 'vitest';
import { INTEGRATION_SLUGS, INTEGRATIONS, integrationSlugSchema } from './integrations';

describe('integrationSlugSchema', () => {
	it('parses a valid slug', () => {
		expect(integrationSlugSchema.parse('obsidian')).toBe('obsidian');
	});

	it('rejects an unknown slug', () => {
		expect(integrationSlugSchema.safeParse('vscode').success).toBe(false);
	});
});

describe('INTEGRATIONS', () => {
	it('covers every slug exactly once, with label and description', () => {
		expect(INTEGRATIONS.map((i) => i.slug)).toEqual([...INTEGRATION_SLUGS]);
		for (const entry of INTEGRATIONS) {
			expect(entry.label.length).toBeGreaterThan(0);
			expect(entry.description.length).toBeGreaterThan(0);
		}
	});
});
