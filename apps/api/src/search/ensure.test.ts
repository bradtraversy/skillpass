import { beforeEach, describe, expect, it, vi } from 'vitest';
import { embeddingContentHash, findEmbeddingBySkill, upsertSkillEmbedding } from '../db/embeddings';
import { findLatestVersionForSkill, findSkillBySlug } from '../db/skills';
import type { Db } from '../db/client';
import type { SkillRow, SkillVersionRow } from '../db/schema';
import type { Env } from '../env';
import { EMBEDDING_MODEL, embedTexts } from './embeddings';
import { ensureEmbedding, skillEmbeddingContent } from './ensure';

vi.mock('../db/skills', () => ({
	findSkillBySlug: vi.fn(),
	findLatestVersionForSkill: vi.fn(),
}));
vi.mock('../db/embeddings', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/embeddings')>()),
	findEmbeddingBySkill: vi.fn(),
	upsertSkillEmbedding: vi.fn(),
}));
vi.mock('./embeddings', async (importOriginal) => ({
	...(await importOriginal<typeof import('./embeddings')>()),
	embedTexts: vi.fn(),
}));

const env = { VOYAGE_API_KEY: 'vk-test' } as Env;
const db = {} as Db;

const skill = {
	id: 7,
	slug: 'pdf',
	name: 'pdf',
	displayName: 'PDF Processing',
	tagline: 'Read and transform PDFs',
	summary: 'Read, extract, and merge PDF files.',
	category: 'docs-writing',
	integrations: ['pdf'],
} as unknown as SkillRow;

const packVersion = {
	packSkills: [{ name: 'brief' }, { name: 'draft' }],
} as unknown as SkillVersionRow;

beforeEach(() => vi.resetAllMocks());

describe('skillEmbeddingContent', () => {
	it('builds the input from listing copy and pack member names', () => {
		const { input, contentHash } = skillEmbeddingContent(skill, packVersion);
		expect(input).toContain('PDF Processing');
		expect(input).toContain('brief');
		expect(contentHash).toBe(embeddingContentHash(EMBEDDING_MODEL, input));
	});

	it('hashes identically for identical copy, so re-runs skip', () => {
		expect(skillEmbeddingContent(skill, undefined).contentHash).toBe(
			skillEmbeddingContent(skill, undefined).contentHash,
		);
	});
});

describe('ensureEmbedding', () => {
	it('no-ops without a key, touching nothing', async () => {
		await ensureEmbedding({} as Env, db, 'pdf');
		expect(findSkillBySlug).not.toHaveBeenCalled();
	});

	it('no-ops for an unknown slug', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		await ensureEmbedding(env, db, 'ghost');
		expect(embedTexts).not.toHaveBeenCalled();
	});

	it('skips the provider when the stored contentHash matches', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(skill);
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(undefined);
		const { contentHash } = skillEmbeddingContent(skill, undefined);
		vi.mocked(findEmbeddingBySkill).mockResolvedValue({ contentHash } as never);

		await ensureEmbedding(env, db, 'pdf');
		expect(embedTexts).not.toHaveBeenCalled();
		expect(upsertSkillEmbedding).not.toHaveBeenCalled();
	});

	it('embeds and upserts when the copy changed', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(skill);
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(packVersion);
		vi.mocked(findEmbeddingBySkill).mockResolvedValue({ contentHash: 'stale' } as never);
		vi.mocked(embedTexts).mockResolvedValue({ success: true, data: [[0.1, 0.2]] });

		await ensureEmbedding(env, db, 'pdf');

		const { input, contentHash } = skillEmbeddingContent(skill, packVersion);
		expect(embedTexts).toHaveBeenCalledWith(env, [input], 'document');
		expect(upsertSkillEmbedding).toHaveBeenCalledWith(db, {
			skillId: 7,
			embedding: [0.1, 0.2],
			contentHash,
			model: EMBEDDING_MODEL,
		});
	});

	it('swallows a provider failure without upserting', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(skill);
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(undefined);
		vi.mocked(findEmbeddingBySkill).mockResolvedValue(undefined);
		vi.mocked(embedTexts).mockResolvedValue({ success: false, error: 'voyage responded 500' });

		await expect(ensureEmbedding(env, db, 'pdf')).resolves.toBeUndefined();
		expect(upsertSkillEmbedding).not.toHaveBeenCalled();
	});

	it('swallows a thrown error so publishing never blocks', async () => {
		vi.mocked(findSkillBySlug).mockRejectedValue(new Error('db down'));
		await expect(ensureEmbedding(env, db, 'pdf')).resolves.toBeUndefined();
	});
});
