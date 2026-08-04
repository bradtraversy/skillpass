import type { Db } from '../db/client';
import { embeddingContentHash, findEmbeddingBySkill, upsertSkillEmbedding } from '../db/embeddings';
import { findLatestVersionForSkill, findSkillBySlug } from '../db/skills';
import type { SkillRow, SkillVersionRow } from '../db/schema';
import type { Env } from '../env';
import { EMBEDDING_MODEL, embeddingInput, embedTexts } from './embeddings';

// The embedding source for one skill: its current listing copy plus pack
// member names, and the hash that decides staleness. Shared with the backfill.
export function skillEmbeddingContent(
	skill: SkillRow,
	version: SkillVersionRow | undefined,
): { input: string; contentHash: string } {
	const input = embeddingInput({
		name: skill.name,
		displayName: skill.displayName,
		tagline: skill.tagline,
		summary: skill.summary,
		category: skill.category,
		integrations: skill.integrations,
		packSkills: version?.packSkills?.map((entry) => entry.name) ?? null,
	});
	return { input, contentHash: embeddingContentHash(EMBEDDING_MODEL, input) };
}

// Embed a skill's listing copy, once per distinct copy. Same discipline as
// ensureAiReview: no key or unchanged content is a no-op, errors are logged
// and swallowed, publishing never blocks on it. Runs after the display-copy /
// category / integrations ensures so it embeds the final copy - hence the
// re-read by slug instead of trusting the caller's stale row.
export async function ensureEmbedding(env: Env, db: Db, slug: string): Promise<void> {
	if (!env.VOYAGE_API_KEY) return;
	try {
		const skill = await findSkillBySlug(db, slug);
		if (!skill) return;

		const version = await findLatestVersionForSkill(db, skill.id);
		const { input, contentHash } = skillEmbeddingContent(skill, version);

		const existing = await findEmbeddingBySkill(db, skill.id);
		if (existing?.contentHash === contentHash) return;

		const result = await embedTexts(env, [input], 'document');
		if (!result.success) {
			console.error(`ensureEmbedding: embed for ${slug} failed: ${result.error}`);
			return;
		}
		await upsertSkillEmbedding(db, {
			skillId: skill.id,
			embedding: result.data[0],
			contentHash,
			model: EMBEDDING_MODEL,
		});
	} catch (err) {
		console.error(`ensureEmbedding: embedding for ${slug} failed: ${err}`);
	}
}
