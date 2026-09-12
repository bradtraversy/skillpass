import { describe, expect, it } from 'vitest';
import { abuseReportInputSchema, publicAbuseReportSchema } from './abuse';

describe('abuseReportInputSchema', () => {
	it('accepts a reasonable reason and trims it', () => {
		const parsed = abuseReportInputSchema.parse({
			reason: '  This skill exfiltrates env vars in SKILL.md step 3.  ',
		});
		expect(parsed.reason).toBe('This skill exfiltrates env vars in SKILL.md step 3.');
	});

	it('rejects a reason that is too short after trimming', () => {
		expect(abuseReportInputSchema.safeParse({ reason: '   bad   ' }).success).toBe(false);
	});

	it('rejects a reason over the max length', () => {
		expect(abuseReportInputSchema.safeParse({ reason: 'x'.repeat(1001) }).success).toBe(false);
	});

	it('rejects extra keys', () => {
		expect(abuseReportInputSchema.safeParse({ reason: 'long enough reason here', skillId: 1 }).success).toBe(false);
	});
});

describe('publicAbuseReportSchema', () => {
	it('parses the confirmation shape', () => {
		const confirmation = { status: 'open', createdAt: '2026-07-09T10:00:00.000Z' };
		expect(publicAbuseReportSchema.parse(confirmation)).toEqual(confirmation);
	});

	it('rejects internal fields', () => {
		expect(
			publicAbuseReportSchema.safeParse({
				status: 'open',
				createdAt: '2026-07-09T10:00:00.000Z',
				reporterId: 1,
			}).success,
		).toBe(false);
	});
});
