import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from './client';
import { skillEmbeddings, type SkillEmbeddingRow } from './schema';

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
