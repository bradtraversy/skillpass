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
	])('rejects %s', (_label, input) => {
		expect(parseAiReview(input).success).toBe(false);
	});

	it('strips an unknown field so older clients survive additive fields', () => {
		const parsed = parseAiReview({ ...valid, riskLevel: 'low' });
		expect(parsed.success).toBe(true);
		expect(parsed.success && 'riskLevel' in parsed.data).toBe(false);
	});
});
