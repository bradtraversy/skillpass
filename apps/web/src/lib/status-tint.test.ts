import { ABUSE_REPORT_STATUSES, SKILL_STATUSES, SUBMISSION_STATUSES } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { STATUS_TINT } from './status-tint';

describe('STATUS_TINT', () => {
	it('covers every skill, submission, and abuse-report status', () => {
		for (const status of [...SKILL_STATUSES, ...SUBMISSION_STATUSES, ...ABUSE_REPORT_STATUSES]) {
			expect(STATUS_TINT[status], status).toBeTruthy();
		}
	});

	it('tints published like a pass and flagged like a failure', () => {
		expect(STATUS_TINT.published).toContain('text-pass');
		expect(STATUS_TINT.flagged).toContain('text-fail');
	});

	it('keeps withdrawn listings neutral, not alarming', () => {
		expect(STATUS_TINT.private).toContain('text-unv');
	});
});
