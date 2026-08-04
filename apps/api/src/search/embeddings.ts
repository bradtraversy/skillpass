import type { Env } from '../env';

export const EMBEDDING_MODEL = 'voyage-3.5-lite';
// voyage-3.5-lite's default output dimension; the skill_embeddings vector
// column is fixed to this, so changing it means a migration plus re-embed.
export const EMBEDDING_DIMENSIONS = 1024;

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
// Voyage allows up to 1,000 texts per request; batching conservatively keeps
// each request small against the per-request token ceiling.
const BATCH_SIZE = 128;
const MAX_INPUT_CHARS = 4000;

// Stored skills embed as documents, searches as queries; Voyage tunes the
// vectors differently per side of the retrieval pair.
export type EmbedInputType = 'document' | 'query';

export interface EmbeddingFields {
	name: string;
	displayName?: string | null;
	tagline?: string | null;
	summary?: string | null;
	category?: string | null;
	integrations?: string[] | null;
	packSkills?: string[] | null;
}

// The searchable listing copy flattened to one embedding input: the fields
// site search matches plus the display copy. Summaries can be raw
// readme-derived HTML (ai-blueprint's literally starts with <p>), so strip tags.
export function embeddingInput(fields: EmbeddingFields): string {
	const parts = [
		fields.name,
		fields.displayName,
		fields.tagline,
		stripHtml(fields.summary ?? ''),
		fields.category,
		...(fields.integrations ?? []),
		...(fields.packSkills ?? []),
	];
	const text = parts
		.map((part) => part?.trim())
		.filter((part): part is string => Boolean(part))
		.join('\n');
	return text.slice(0, MAX_INPUT_CHARS);
}

function stripHtml(text: string): string {
	return text
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export type EmbedResult =
	| { success: true; data: number[][] }
	| { success: false; error: string };

interface VoyageResponse {
	data: { index: number; embedding: number[] }[];
}

// Batched: N texts in, N vectors out in input order, chunked to the provider
// cap so a full backfill is a couple of requests rather than one per skill.
export async function embedTexts(
	env: Env,
	texts: string[],
	inputType: EmbedInputType,
): Promise<EmbedResult> {
	if (!env.VOYAGE_API_KEY) return { success: false, error: 'VOYAGE_API_KEY not configured' };
	if (texts.length === 0) return { success: true, data: [] };

	const vectors: number[][] = [];
	for (let start = 0; start < texts.length; start += BATCH_SIZE) {
		const chunk = texts.slice(start, start + BATCH_SIZE);
		let res: Response;
		try {
			res = await fetch(VOYAGE_URL, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${env.VOYAGE_API_KEY}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({ model: EMBEDDING_MODEL, input: chunk, input_type: inputType }),
			});
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
		if (!res.ok) return { success: false, error: `voyage responded ${res.status}` };

		const body = (await res.json()) as VoyageResponse;
		// The API documents index-ordered data; sort defensively anyway.
		const ordered = [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
		if (ordered.length !== chunk.length) {
			return { success: false, error: 'voyage returned a mismatched embedding count' };
		}
		vectors.push(...ordered);
	}
	return { success: true, data: vectors };
}
