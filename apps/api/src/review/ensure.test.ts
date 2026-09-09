import type { AiReview, ValidationReport } from 'skill-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client';
import { findAiReviewByHash, upsertAiReview } from '../db/reviews';
import { setSkillCategory, setSkillDisplayCopy, setSkillIntegrations } from '../db/skills';
import { loadEnv } from '../env';
import { getSnapshotDocument } from '../storage/r2';
import { RAW_TEST_ENV } from '../testing/env';
import { classifyCategory } from './classify';
import { classifyIntegrations } from './classify-integrations';
import { generateDisplayCopy } from './display-copy';
import { ensureAiReview, ensureCategory, ensureDisplayCopy, ensureIntegrations } from './ensure';
import { reviewSkill } from './review';

vi.mock('../db/reviews', () => ({ findAiReviewByHash: vi.fn(), upsertAiReview: vi.fn() }));
vi.mock('../db/skills', () => ({
	setSkillCategory: vi.fn(),
	setSkillDisplayCopy: vi.fn(),
	setSkillIntegrations: vi.fn(),
}));
vi.mock('../storage/r2', () => ({ getSnapshotDocument: vi.fn() }));
vi.mock('./classify', () => ({ classifyCategory: vi.fn() }));
vi.mock('./classify-integrations', () => ({ classifyIntegrations: vi.fn() }));
vi.mock('./display-copy', () => ({ generateDisplayCopy: vi.fn() }));
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
		data: { version: 1, files: [{ path: 'SKILL.md', content: '# demo' }] },
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

const uncategorized = {
	id: 3,
	slug: 'clean-skill',
	category: null,
	name: 'Clean Skill',
	summary: 'A tidy demo skill.',
};

describe('ensureCategory', () => {
	it('classifies and stores a category for an uncategorized skill', async () => {
		vi.mocked(classifyCategory).mockResolvedValue('dev-tooling');

		await ensureCategory(envWithKey, db, uncategorized);

		expect(classifyCategory).toHaveBeenCalledWith(envWithKey, {
			name: 'Clean Skill',
			summary: 'A tidy demo skill.',
		});
		expect(setSkillCategory).toHaveBeenCalledWith(db, 3, 'dev-tooling');
	});

	it('is a no-op when the skill already has a category (does not call the model)', async () => {
		await ensureCategory(envWithKey, db, { ...uncategorized, category: 'testing' });

		expect(classifyCategory).not.toHaveBeenCalled();
		expect(setSkillCategory).not.toHaveBeenCalled();
	});

	it('is a no-op without an API key', async () => {
		await ensureCategory(envNoKey, db, uncategorized);

		expect(classifyCategory).not.toHaveBeenCalled();
		expect(setSkillCategory).not.toHaveBeenCalled();
	});

	it('stores nothing when the classifier returns null', async () => {
		vi.mocked(classifyCategory).mockResolvedValue(null);

		await ensureCategory(envWithKey, db, uncategorized);

		expect(setSkillCategory).not.toHaveBeenCalled();
	});

	it('swallows a thrown error and stores nothing', async () => {
		vi.mocked(classifyCategory).mockRejectedValue(new Error('boom'));

		await expect(ensureCategory(envWithKey, db, uncategorized)).resolves.toBeUndefined();
		expect(setSkillCategory).not.toHaveBeenCalled();
	});
});

const uncopied = {
	id: 4,
	slug: 'clean-skill',
	displayName: null,
	tagline: null,
	name: 'clean-skill',
	summary: 'A tidy demo skill.',
};

const copy = { displayName: 'Clean Skill', tagline: 'Tidies demo residue.' };

describe('ensureDisplayCopy', () => {
	it('generates and stores copy for a skill without any', async () => {
		vi.mocked(generateDisplayCopy).mockResolvedValue(copy);

		await ensureDisplayCopy(envWithKey, db, uncopied);

		expect(generateDisplayCopy).toHaveBeenCalledWith(envWithKey, {
			name: 'clean-skill',
			summary: 'A tidy demo skill.',
		});
		expect(setSkillDisplayCopy).toHaveBeenCalledWith(db, 4, copy);
	});

	it('is a no-op when both fields are already set (does not call the model)', async () => {
		await ensureDisplayCopy(envWithKey, db, { ...uncopied, ...copy });

		expect(generateDisplayCopy).not.toHaveBeenCalled();
		expect(setSkillDisplayCopy).not.toHaveBeenCalled();
	});

	it('regenerates when only one field is set', async () => {
		vi.mocked(generateDisplayCopy).mockResolvedValue(copy);

		await ensureDisplayCopy(envWithKey, db, { ...uncopied, displayName: 'Clean Skill' });

		expect(setSkillDisplayCopy).toHaveBeenCalledWith(db, 4, copy);
	});

	it('is a no-op without an API key', async () => {
		await ensureDisplayCopy(envNoKey, db, uncopied);

		expect(generateDisplayCopy).not.toHaveBeenCalled();
		expect(setSkillDisplayCopy).not.toHaveBeenCalled();
	});

	it('stores nothing when the generator returns null', async () => {
		vi.mocked(generateDisplayCopy).mockResolvedValue(null);

		await ensureDisplayCopy(envWithKey, db, uncopied);

		expect(setSkillDisplayCopy).not.toHaveBeenCalled();
	});

	it('swallows a thrown error and stores nothing', async () => {
		vi.mocked(generateDisplayCopy).mockRejectedValue(new Error('boom'));

		await expect(ensureDisplayCopy(envWithKey, db, uncopied)).resolves.toBeUndefined();
		expect(setSkillDisplayCopy).not.toHaveBeenCalled();
	});
});

const unclassified = {
	id: 5,
	slug: 'clean-skill',
	integrations: null,
	name: 'clean-skill',
	summary: 'A tidy demo skill.',
};

describe('ensureIntegrations', () => {
	it('classifies and stores a list for a never-classified skill', async () => {
		vi.mocked(classifyIntegrations).mockResolvedValue(['obsidian']);

		await ensureIntegrations(envWithKey, db, unclassified);

		expect(classifyIntegrations).toHaveBeenCalledWith(envWithKey, {
			name: 'clean-skill',
			summary: 'A tidy demo skill.',
		});
		expect(setSkillIntegrations).toHaveBeenCalledWith(db, 5, ['obsidian']);
	});

	it('stores an empty list as a valid "none" classification', async () => {
		vi.mocked(classifyIntegrations).mockResolvedValue([]);

		await ensureIntegrations(envWithKey, db, unclassified);

		expect(setSkillIntegrations).toHaveBeenCalledWith(db, 5, []);
	});

	it('skips a skill already classified as none (empty list, not null)', async () => {
		await ensureIntegrations(envWithKey, db, { ...unclassified, integrations: [] });

		expect(classifyIntegrations).not.toHaveBeenCalled();
		expect(setSkillIntegrations).not.toHaveBeenCalled();
	});

	it('skips a skill with integrations already set', async () => {
		await ensureIntegrations(envWithKey, db, { ...unclassified, integrations: ['github'] });

		expect(classifyIntegrations).not.toHaveBeenCalled();
	});

	it('is a no-op without an API key', async () => {
		await ensureIntegrations(envNoKey, db, unclassified);

		expect(classifyIntegrations).not.toHaveBeenCalled();
	});

	it('stores nothing when the classifier returns null', async () => {
		vi.mocked(classifyIntegrations).mockResolvedValue(null);

		await ensureIntegrations(envWithKey, db, unclassified);

		expect(setSkillIntegrations).not.toHaveBeenCalled();
	});

	it('swallows a thrown error and stores nothing', async () => {
		vi.mocked(classifyIntegrations).mockRejectedValue(new Error('boom'));

		await expect(ensureIntegrations(envWithKey, db, unclassified)).resolves.toBeUndefined();
		expect(setSkillIntegrations).not.toHaveBeenCalled();
	});
});
