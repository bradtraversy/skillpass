import type { AiReview, ValidationReport } from 'skill-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client';
import { findAiReviewByHash, upsertAiReview } from '../db/reviews';
import { loadEnv } from '../env';
import { getSnapshotDocument } from '../storage/r2';
import { RAW_TEST_ENV } from '../testing/env';
import { ensureAiReview } from './ensure';
import { reviewSkill } from './review';

vi.mock('../db/reviews', () => ({ findAiReviewByHash: vi.fn(), upsertAiReview: vi.fn() }));
vi.mock('../storage/r2', () => ({ getSnapshotDocument: vi.fn() }));
vi.mock('./review', () => ({ reviewSkill: vi.fn() }));

const envWithKey = loadEnv({ ...RAW_TEST_ENV, ANTHROPIC_API_KEY: 'sk-ant-test' });
const envNoKey = loadEnv(RAW_TEST_ENV);
const db = {} as Db;

const report = { sourceHash: 'sha256:abc' } as ValidationReport;
const review: AiReview = {
	summary: 'Reads PDFs.',
	verdict: 'clear',
	reasoning: 'Local files only.',
	model: 'claude-haiku-4-5',
	reviewedAt: '2026-07-26T12:00:00.000Z',
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getSnapshotDocument).mockResolvedValue({
		success: true,
		data: { files: [{ path: 'SKILL.md', content: '# demo' }] },
	});
});

describe('ensureAiReview', () => {
	it('generates and caches a review for a fresh source hash', async () => {
		vi.mocked(findAiReviewByHash).mockResolvedValue(undefined);
		vi.mocked(reviewSkill).mockResolvedValue(review);

		await ensureAiReview(envWithKey, db, 'sha256:abc', 'snapshots/abc.json', report);

		expect(reviewSkill).toHaveBeenCalledOnce();
		expect(upsertAiReview).toHaveBeenCalledWith(db, 'sha256:abc', review);
	});

	it('is a no-op when a review already exists (does not call the model)', async () => {
		vi.mocked(findAiReviewByHash).mockResolvedValue({ id: 1, sourceHash: 'sha256:abc', review, createdAt: new Date() });

		await ensureAiReview(envWithKey, db, 'sha256:abc', 'snapshots/abc.json', report);

		expect(reviewSkill).not.toHaveBeenCalled();
		expect(upsertAiReview).not.toHaveBeenCalled();
	});

	it('is a no-op without an API key (never touches the db or model)', async () => {
		await ensureAiReview(envNoKey, db, 'sha256:abc', 'snapshots/abc.json', report);

		expect(findAiReviewByHash).not.toHaveBeenCalled();
		expect(reviewSkill).not.toHaveBeenCalled();
		expect(upsertAiReview).not.toHaveBeenCalled();
	});

	it('stores nothing when the reviewer returns null', async () => {
		vi.mocked(findAiReviewByHash).mockResolvedValue(undefined);
		vi.mocked(reviewSkill).mockResolvedValue(null);

		await ensureAiReview(envWithKey, db, 'sha256:abc', 'snapshots/abc.json', report);

		expect(upsertAiReview).not.toHaveBeenCalled();
	});

	it('swallows a thrown error and stores nothing', async () => {
		vi.mocked(findAiReviewByHash).mockResolvedValue(undefined);
		vi.mocked(reviewSkill).mockRejectedValue(new Error('boom'));

		await expect(
			ensureAiReview(envWithKey, db, 'sha256:abc', 'snapshots/abc.json', report),
		).resolves.toBeUndefined();
		expect(upsertAiReview).not.toHaveBeenCalled();
	});

	it('stores nothing when the snapshot is missing', async () => {
		vi.mocked(findAiReviewByHash).mockResolvedValue(undefined);
		vi.mocked(getSnapshotDocument).mockResolvedValue({ success: false, error: 'r2 object missing' });

		await ensureAiReview(envWithKey, db, 'sha256:abc', 'snapshots/abc.json', report);

		expect(reviewSkill).not.toHaveBeenCalled();
		expect(upsertAiReview).not.toHaveBeenCalled();
	});
});
