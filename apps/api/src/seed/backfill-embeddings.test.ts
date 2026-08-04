import { describe, expect, it } from 'vitest';
import { pendingEmbeddings, type EmbeddingCandidate } from './backfill-embeddings';

const candidate = (skillId: number, contentHash: string): EmbeddingCandidate => ({
	skillId,
	slug: `skill-${skillId}`,
	input: `input ${skillId}`,
	contentHash,
});

describe('pendingEmbeddings', () => {
	it('keeps skills with no stored embedding', () => {
		const pending = pendingEmbeddings([candidate(1, 'aaa')], new Map());
		expect(pending.map((p) => p.skillId)).toEqual([1]);
	});

	it('keeps skills whose stored hash is stale and drops current ones', () => {
		const existing = new Map([
			[1, 'aaa'],
			[2, 'old'],
		]);
		const pending = pendingEmbeddings([candidate(1, 'aaa'), candidate(2, 'bbb')], existing);
		expect(pending.map((p) => p.skillId)).toEqual([2]);
	});

	it('returns empty when everything is current', () => {
		const existing = new Map([[1, 'aaa']]);
		expect(pendingEmbeddings([candidate(1, 'aaa')], existing)).toEqual([]);
	});
});
