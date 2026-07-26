import { describe, expect, it } from 'vitest';
import { parseAiReview } from './ai-review';

const valid = {
	summary: 'Extracts text from PDFs and writes a markdown summary.',
	verdict: 'clear' as const,
	reasoning: 'Reads local files and prints output; no network or credential access.',
	model: 'claude-haiku-4-5',
	reviewedAt: '2026-07-26T12:00:00.000Z',
};

describe('parseAiReview', () => {
	it('accepts a valid review', () => {
		const result = parseAiReview(valid);
		expect(result.success).toBe(true);
	});

	it.each(['clear', 'caution', 'concern'])('accepts the %s verdict', (verdict) => {
		expect(parseAiReview({ ...valid, verdict }).success).toBe(true);
	});

	it.each([
		['a bad verdict', { ...valid, verdict: 'safe' }],
		['an empty summary', { ...valid, summary: '' }],
		['an empty reasoning', { ...valid, reasoning: '' }],
		['a non-datetime reviewedAt', { ...valid, reviewedAt: '2026-07-26' }],
		['a missing model', { ...valid, model: undefined }],
		['an unknown field', { ...valid, riskLevel: 'low' }],
	])('rejects %s', (_label, input) => {
		expect(parseAiReview(input).success).toBe(false);
	});
});
