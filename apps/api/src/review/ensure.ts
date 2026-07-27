import type { CategorySlug, ValidationReport } from 'skill-schema';
import { loadPackageFromFiles } from 'validator';
import type { Db } from '../db/client';
import { findAiReviewByHash, upsertAiReview } from '../db/reviews';
import { setSkillCategory } from '../db/skills';
import type { Env } from '../env';
import { getSnapshotDocument } from '../storage/r2';
import { classifyCategory } from './classify';
import { reviewSkill } from './review';

// Generate and cache the AI review for a source hash, once. No-ops when the key
// is absent or a review already exists; never throws, so publishing never blocks
// on it. Re-fetches the snapshot from R2 because the caller (publish) holds the
// report but not the package files.
export async function ensureAiReview(
	env: Env,
	db: Db,
	sourceHash: string,
	snapshotKey: string,
	report: ValidationReport,
): Promise<void> {
	if (!env.ANTHROPIC_API_KEY) return;
	try {
		if (await findAiReviewByHash(db, sourceHash)) return;

		const snapshot = await getSnapshotDocument(env, snapshotKey);
		if (!snapshot.success) return;

		const pkg = loadPackageFromFiles(snapshot.data.files, sourceHash);
		const review = await reviewSkill(env, pkg, report);
		if (review) await upsertAiReview(db, sourceHash, review);
	} catch (err) {
		console.error(`ensureAiReview: review for ${sourceHash} failed: ${err}`);
	}
}

// Classify and store a category for a skill that has none. Same discipline as
// ensureAiReview: no key or an existing category is a no-op; never throws.
export async function ensureCategory(
	env: Env,
	db: Db,
	skill: { id: number; slug: string; category: CategorySlug | null; name: string; summary: string },
): Promise<void> {
	if (!env.ANTHROPIC_API_KEY || skill.category) return;
	try {
		const category = await classifyCategory(env, { name: skill.name, summary: skill.summary });
		if (category) await setSkillCategory(db, skill.id, category);
	} catch (err) {
		console.error(`ensureCategory: classify for ${skill.slug} failed: ${err}`);
	}
}
