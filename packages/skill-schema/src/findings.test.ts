import { describe, expect, it } from 'vitest';
import { FINDING_COPY, findingCopy } from './findings';

describe('findingCopy', () => {
	it('returns label and description for a mapped code', () => {
		const copy = findingCopy('credential-harvesting');
		expect(copy?.label).toBe('Credential access pattern');
		expect(copy?.description).toContain('read the flagged line');
	});

	it('returns null for an unmapped code', () => {
		expect(findingCopy('brand-new-code')).toBeNull();
	});

	it('frames advisory copy as matches, not verdicts', () => {
		for (const code of ['credential-harvesting', 'dangerous-command', 'malware', 'prompt-injection']) {
			expect(FINDING_COPY[code].description.toLowerCase()).toMatch(/match/);
		}
	});
});
