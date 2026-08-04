import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import { embeddingInput, embedTexts } from './embeddings';

const env = { VOYAGE_API_KEY: 'vk-test' } as Env;
const noKeyEnv = {} as Env;

function voyageOk(embeddings: number[][], shuffle = false) {
	const data = embeddings.map((embedding, index) => ({ index, embedding }));
	if (shuffle) data.reverse();
	return {
		ok: true,
		status: 200,
		json: async () => ({ data }),
	} as Response;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('embeddingInput', () => {
	it('joins name, display copy, category, integrations, and pack names', () => {
		const text = embeddingInput({
			name: 'editorial-workflow-skill',
			displayName: 'Editorial Workflow',
			tagline: 'Structured editorial process',
			summary: 'A repeatable editorial system.',
			category: 'docs-writing',
			integrations: ['obsidian'],
			packSkills: ['brief', 'draft', 'review'],
		});
		expect(text).toBe(
			'editorial-workflow-skill\nEditorial Workflow\nStructured editorial process\nA repeatable editorial system.\ndocs-writing\nobsidian\nbrief\ndraft\nreview',
		);
	});

	it('skips null, absent, and whitespace-only fields', () => {
		const text = embeddingInput({ name: 'pdf', displayName: null, tagline: '  ', summary: null });
		expect(text).toBe('pdf');
	});

	it('strips HTML tags from readme-derived summaries', () => {
		const text = embeddingInput({
			name: 'ai-blueprint',
			summary: '<p align="center">Spec-driven <b>workflow</b> pack</p>',
		});
		expect(text).toBe('ai-blueprint\nSpec-driven workflow pack');
	});

	it('caps the input length', () => {
		const text = embeddingInput({ name: 'x', summary: 'a'.repeat(10_000) });
		expect(text.length).toBe(4000);
	});
});

describe('embedTexts', () => {
	it('fails without a key and never calls the API', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const result = await embedTexts(noKeyEnv, ['hello'], 'document');
		expect(result).toEqual({ success: false, error: 'VOYAGE_API_KEY not configured' });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns empty data for empty input without calling the API', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const result = await embedTexts(env, [], 'document');
		expect(result).toEqual({ success: true, data: [] });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns vectors in input order even when the API responds out of order', async () => {
		const fetchMock = vi.fn().mockResolvedValue(voyageOk([[1, 2], [3, 4]], true));
		vi.stubGlobal('fetch', fetchMock);
		const result = await embedTexts(env, ['a', 'b'], 'query');
		expect(result).toEqual({ success: true, data: [[1, 2], [3, 4]] });
		const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
		expect(body).toMatchObject({ model: 'voyage-3.5-lite', input: ['a', 'b'], input_type: 'query' });
	});

	it('chunks past the 128-text request cap', async () => {
		const fetchMock = vi
			.fn()
			.mockImplementation(async (_url, init: RequestInit) => {
				const { input } = JSON.parse(init.body as string) as { input: string[] };
				return voyageOk(input.map((_, i) => [i]));
			});
		vi.stubGlobal('fetch', fetchMock);
		const texts = Array.from({ length: 130 }, (_, i) => `text-${i}`);
		const result = await embedTexts(env, texts, 'document');
		expect(result.success).toBe(true);
		if (result.success) expect(result.data).toHaveLength(130);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).input).toHaveLength(128);
		expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).input).toHaveLength(2);
	});

	it('surfaces an HTTP error as a failed result', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 } as Response));
		const result = await embedTexts(env, ['a'], 'document');
		expect(result).toEqual({ success: false, error: 'voyage responded 429' });
	});

	it('surfaces a network failure as a failed result', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
		const result = await embedTexts(env, ['a'], 'document');
		expect(result).toEqual({ success: false, error: 'ECONNREFUSED' });
	});

	it('rejects a mismatched embedding count', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(voyageOk([[1]])));
		const result = await embedTexts(env, ['a', 'b'], 'document');
		expect(result).toEqual({ success: false, error: 'voyage returned a mismatched embedding count' });
	});
});
