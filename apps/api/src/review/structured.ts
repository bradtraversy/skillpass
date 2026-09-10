import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../env';

export const REVIEW_MODEL = 'claude-haiku-4-5';
const LISTING_CHAR_CAP = 2_000;

export interface StructuredAsk {
	system: string;
	user: string;
	schema: Record<string, unknown>;
	maxTokens: number;
}

// One model call for a JSON answer. Returns null (never throws) when the key
// is absent, the model refuses, the answer is empty or not JSON, or the call
// fails; the failure is logged so a billing or auth problem shows up in the
// server log instead of as a silent "no result".
export async function askStructured(env: Env, ask: StructuredAsk): Promise<unknown> {
	if (!env.ANTHROPIC_API_KEY) return null;

	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	try {
		const response = await client.messages.create({
			model: REVIEW_MODEL,
			max_tokens: ask.maxTokens,
			system: ask.system,
			output_config: { format: { type: 'json_schema', schema: ask.schema } },
			messages: [{ role: 'user', content: ask.user }],
		});
		if (response.stop_reason === 'refusal') return null;
		const text = response.content.find((block) => block.type === 'text')?.text;
		return text ? JSON.parse(text) : null;
	} catch (err) {
		console.error('model call failed:', err instanceof Error ? err.message : err);
		return null;
	}
}

// The listing text is untrusted input framed as data, never as instructions.
export function listingContent(lead: string, listing: { name: string; summary: string }): string {
	return `${lead}\n\n<skill_content>\nname: ${listing.name}\nsummary: ${listing.summary.slice(0, LISTING_CHAR_CAP)}\n</skill_content>`;
}
