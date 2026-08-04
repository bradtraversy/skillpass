import { fileURLToPath } from 'node:url';
import { createDb, type Db } from '../db/client';
import { upsertSkillEmbedding } from '../db/embeddings';
import { skillEmbeddings } from '../db/schema';
import { listPublishedSkills } from '../db/skills';
import { loadEnv, type Env } from '../env';
import { EMBEDDING_MODEL, embedTexts } from '../search/embeddings';
import { skillEmbeddingContent } from '../search/ensure';

export interface EmbeddingCandidate {
	skillId: number;
	slug: string;
	input: string;
	contentHash: string;
}

// The skip/refresh decision: a candidate is pending when no embedding is
// stored for it or the stored one was built from different copy (or model).
export function pendingEmbeddings(
	candidates: EmbeddingCandidate[],
	existing: Map<number, string>,
): EmbeddingCandidate[] {
	return candidates.filter((c) => existing.get(c.skillId) !== c.contentHash);
}

async function main() {
	const env: Env = loadEnv();
	const db: Db = createDb(env.DATABASE_URL);

	if (!env.VOYAGE_API_KEY) {
		console.log('VOYAGE_API_KEY is not set; nothing to embed.');
		return;
	}

	const records = await listPublishedSkills(db);
	const candidates: EmbeddingCandidate[] = records.map((r) => {
		const { input, contentHash } = skillEmbeddingContent(r.skill, r.version);
		return { skillId: r.skill.id, slug: r.skill.slug, input, contentHash };
	});

	const existingRows = await db
		.select({ skillId: skillEmbeddings.skillId, contentHash: skillEmbeddings.contentHash })
		.from(skillEmbeddings);
	const pending = pendingEmbeddings(
		candidates,
		new Map(existingRows.map((r) => [r.skillId, r.contentHash])),
	);
	console.log(`${candidates.length} published skills, ${pending.length} need embedding\n`);
	if (pending.length === 0) {
		console.log('done: all embeddings up to date');
		return;
	}

	// One batched provider call for the whole run; embedTexts chunks internally.
	const result = await embedTexts(env, pending.map((p) => p.input), 'document');
	if (!result.success) {
		console.error(`embedding failed: ${result.error}`);
		process.exit(1);
	}

	for (const [i, candidate] of pending.entries()) {
		await upsertSkillEmbedding(db, {
			skillId: candidate.skillId,
			embedding: result.data[i],
			contentHash: candidate.contentHash,
			model: EMBEDDING_MODEL,
		});
		console.log(`  embedded ${candidate.slug}`);
	}

	console.log(
		`\ndone: ${pending.length} embedded, ${candidates.length - pending.length} up to date`,
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((err) => {
		console.error('backfill failed:', err);
		process.exit(1);
	});
}
