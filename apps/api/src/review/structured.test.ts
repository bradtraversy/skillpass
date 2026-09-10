import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import { askStructured, listingContent, REVIEW_MODEL } from './structured';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
	default: class {
		messages = { create: mockCreate };
	},
}));

const env = { ANTHROPIC_API_KEY: 'sk-test' } as Env;
const ask = { system: 'sys', user: 'usr', schema: { type: 'object' }, maxTokens: 64 };
const answer = (text: string, stop_reason = 'end_turn') => ({
	stop_reason,
	content: [{ type: 'text', text }],
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('askStructured', () => {
	it('returns the parsed answer and passes the request through', async () => {
		mockCreate.mockResolvedValue(answer('{"ok":true}'));
		await expect(askStructured(env, ask)).resolves.toEqual({ ok: true });
		expect(mockCreate).toHaveBeenCalledWith({
			model: REVIEW_MODEL,
			max_tokens: 64,
			system: 'sys',
			output_config: { format: { type: 'json_schema', schema: { type: 'object' } } },
			messages: [{ role: 'user', content: 'usr' }],
		});
	});

	it('returns null without a key and never calls the model', async () => {
		await expect(askStructured({} as Env, ask)).resolves.toBeNull();
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it.each([
		['a refusal', answer('{"ok":true}', 'refusal')],
		['no text block', { stop_reason: 'end_turn', content: [] }],
		['a non-JSON answer', answer('not json')],
	])('returns null on %s', async (_label, response) => {
		mockCreate.mockResolvedValue(response);
		await expect(askStructured(env, ask)).resolves.toBeNull();
	});

	it('returns null on a thrown call and logs the reason', async () => {
		mockCreate.mockRejectedValue(new Error('credit balance is too low'));
		await expect(askStructured(env, ask)).resolves.toBeNull();
		expect(console.error).toHaveBeenCalledWith('model call failed:', 'credit balance is too low');
	});
});

describe('listingContent', () => {
	it('frames the listing as data under the lead and caps the summary', () => {
		const text = listingContent('Classify the skill below.', { name: 'x', summary: 'y'.repeat(3_000) });
		expect(text.startsWith('Classify the skill below.\n\n<skill_content>\nname: x\nsummary: ')).toBe(true);
		expect(text.endsWith('\n</skill_content>')).toBe(true);
		expect(text.length).toBeLessThan(2_200);
	});
});
