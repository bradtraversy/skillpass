import { describe, expect, it } from 'vitest';
import { submissionSourceTypeSchema, submissionStatusSchema } from './submission';

describe('submission enums', () => {
	it('accepts the submission source types', () => {
		expect(submissionSourceTypeSchema.parse('github_url')).toBe('github_url');
		expect(submissionSourceTypeSchema.parse('zip')).toBe('zip');
	});

	it('rejects the SkillVersion source spelling', () => {
		expect(submissionSourceTypeSchema.safeParse('github').success).toBe(false);
	});

	it('covers the full submission lifecycle', () => {
		for (const status of ['draft', 'validating', 'passed', 'warning', 'failed', 'published']) {
			expect(submissionStatusSchema.parse(status)).toBe(status);
		}
		expect(submissionStatusSchema.safeParse('unverified').success).toBe(false);
	});
});
