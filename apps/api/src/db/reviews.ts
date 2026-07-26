import { eq } from 'drizzle-orm';
import type { AiReview } from 'skill-schema';
import type { Db } from './client';
import { aiReviews, type AiReviewRow } from './schema';

export async function findAiReviewByHash(db: Db, sourceHash: string): Promise<AiReviewRow | undefined> {
	const [row] = await db.select().from(aiReviews).where(eq(aiReviews.sourceHash, sourceHash));
	return row;
}

// Insert-or-ignore by source hash: the first review for a snapshot wins, so a
// concurrent or repeated publish never overwrites or errors.
export async function upsertAiReview(db: Db, sourceHash: string, review: AiReview): Promise<void> {
	await db.insert(aiReviews).values({ sourceHash, review }).onConflictDoNothing({ target: aiReviews.sourceHash });
}
