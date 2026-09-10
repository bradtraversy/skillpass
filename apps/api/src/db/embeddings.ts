import { createHash } from 'node:crypto';
import { cosineDistance, eq } from 'drizzle-orm';
import type { Db } from './client';
import { skillEmbeddings, skills, type SkillEmbeddingRow } from './schema';
import { joinPublished, PUBLISHED_SELECT, type PublishedSkillRecord } from './skills';

// The staleness key: same model + same input text -> same hash -> skip.
export function embeddingContentHash(model: string, input: string): string {
	return createHash('sha256').update(`${model}\n${input}`).digest('hex');
}

export async function findEmbeddingBySkill(
	db: Db,
	skillId: number,
): Promise<SkillEmbeddingRow | undefined> {
	const [row] = await db.select().from(skillEmbeddings).where(eq(skillEmbeddings.skillId, skillId));
	return row;
}

// Published skills nearest to the query vector, in relevance (cosine) order -
// the row order IS the contract; callers must not re-sort.
export async function searchSkillsByEmbedding(
	db: Db,
	queryVector: number[],
	limit = 20,
): Promise<PublishedSkillRecord[]> {
	return joinPublished(
		db
			.select(PUBLISHED_SELECT)
			.from(skillEmbeddings)
			.innerJoin(skills, eq(skillEmbeddings.skillId, skills.id))
			.$dynamic(),
	)
		.orderBy(cosineDistance(skillEmbeddings.embedding, queryVector))
		.limit(limit);
}

// Replace-on-conflict, unlike the ai_reviews insert-or-ignore: a skill's copy
// changes across publishes and the embedding must follow it.
export async function upsertSkillEmbedding(
	db: Db,
	values: { skillId: number; embedding: number[]; contentHash: string; model: string },
	now: Date = new Date(),
): Promise<void> {
	await db
		.insert(skillEmbeddings)
		.values({ ...values, updatedAt: now })
		.onConflictDoUpdate({
			target: skillEmbeddings.skillId,
			set: {
				embedding: values.embedding,
				contentHash: values.contentHash,
				model: values.model,
				updatedAt: now,
			},
		});
}
