import { z } from 'zod';
import { parseWith, type ParseResult } from './result';

export const aiReviewVerdictSchema = z.enum(['clear', 'caution', 'concern']);
export type AiReviewVerdict = z.infer<typeof aiReviewVerdictSchema>;

// The LLM review cached on a passport: a plain-English "what it does" plus a
// hedged safety read. Advisory, never a guarantee - the UI frames it as such.
export const aiReviewSchema = z.strictObject({
	summary: z.string().min(1).max(600),
	verdict: aiReviewVerdictSchema,
	reasoning: z.string().min(1).max(800),
	model: z.string().min(1),
	reviewedAt: z.iso.datetime(),
});

export type AiReview = z.infer<typeof aiReviewSchema>;

export function parseAiReview(input: unknown): ParseResult<AiReview> {
	return parseWith(aiReviewSchema, input);
}
