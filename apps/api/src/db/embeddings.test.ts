import { describe, expect, it } from 'vitest';
import { embeddingContentHash } from './embeddings';

describe('embeddingContentHash', () => {
	it('is deterministic for the same model and input', () => {
		expect(embeddingContentHash('voyage-3.5-lite', 'pdf tools')).toBe(
			embeddingContentHash('voyage-3.5-lite', 'pdf tools'),
		);
	});

	it('changes when the input changes', () => {
		expect(embeddingContentHash('voyage-3.5-lite', 'a')).not.toBe(
			embeddingContentHash('voyage-3.5-lite', 'b'),
		);
	});

	it('changes when the model changes, so a model swap re-embeds', () => {
		expect(embeddingContentHash('voyage-3.5-lite', 'a')).not.toBe(
			embeddingContentHash('voyage-4', 'a'),
		);
	});

	it('does not collide across the model/input boundary', () => {
		expect(embeddingContentHash('m', 'odel-text')).not.toBe(embeddingContentHash('mo', 'del-text'));
	});
});
