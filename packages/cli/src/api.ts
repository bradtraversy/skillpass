import {
	publicPreflightSchema,
	publicSkillDetailSchema,
	type PublicPreflight,
	type PublicSkillDetail,
} from 'skill-schema';
import type { CommandResult } from './scan';

export const DEFAULT_API_URL = 'https://api.skillpass.dev';

export function resolveApiUrl(override?: string): string {
	const url = override ?? process.env.SKILLPASS_API;
	return (url || DEFAULT_API_URL).replace(/\/$/, '');
}

export function parseSkillRef(ref: string): { slug: string; version?: string } {
	const at = ref.indexOf('@');
	return at === -1 ? { slug: ref } : { slug: ref.slice(0, at), version: ref.slice(at + 1) };
}

export type FetchOutcome<T> =
	| { ok: true; data: T }
	| { ok: false; notFound: boolean; message: string };

// Structural subset of a zod schema, so the CLI needs no direct zod dependency.
export interface ContractSchema<T> {
	safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export async function getParsed<T>(
	fetchImpl: typeof fetch,
	url: string,
	schema: ContractSchema<T>,
): Promise<FetchOutcome<T>> {
	let res: Response;
	try {
		res = await fetchImpl(url);
	} catch {
		return { ok: false, notFound: false, message: `cannot reach the API at ${url}` };
	}
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return { ok: false, notFound: false, message: `unexpected response from the API (${res.status})` };
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		!('success' in body) ||
		(body as { success: boolean }).success !== true
	) {
		return res.status === 404
			? { ok: false, notFound: true, message: 'not found' }
			: { ok: false, notFound: false, message: `the API returned an error (${res.status})` };
	}
	const parsed = schema.safeParse((body as unknown as { data: unknown }).data);
	if (!parsed.success) {
		return { ok: false, notFound: false, message: 'the API response did not match the expected contract' };
	}
	return { ok: true, data: parsed.data };
}

export type PreflightFetch =
	| { ok: true; slug: string; detail: PublicSkillDetail; preflight: PublicPreflight }
	| { ok: false; result: CommandResult };

// Shared resolution for report and add: ref -> detail + version-pinned preflight.
export async function fetchPreflight(
	fetchImpl: typeof fetch,
	apiUrl: string,
	ref: string,
): Promise<PreflightFetch> {
	const { slug, version } = parseSkillRef(ref);
	if (!slug || version === '') {
		return { ok: false, result: { lines: [`error: invalid skill reference "${ref}"`], exitCode: 2 } };
	}

	const detailPath = version
		? `/skills/${encodeURIComponent(slug)}/${encodeURIComponent(version)}`
		: `/skills/${encodeURIComponent(slug)}`;
	const detail = await getParsed(fetchImpl, `${apiUrl}${detailPath}`, publicSkillDetailSchema);
	if (!detail.ok) {
		return {
			ok: false,
			result: detail.notFound
				? {
						lines: [`error: ${version ? `${slug}@${version}` : slug} is not published on the directory`],
						exitCode: 2,
					}
				: { lines: [`error: ${detail.message}`], exitCode: 2 },
		};
	}

	const pinned = version ?? detail.data.version;
	const preflight = await getParsed(
		fetchImpl,
		`${apiUrl}/skills/${encodeURIComponent(slug)}/${encodeURIComponent(pinned)}/preflight`,
		publicPreflightSchema,
	);
	if (!preflight.ok) {
		return { ok: false, result: { lines: [`error: ${preflight.message}`], exitCode: 2 } };
	}

	return { ok: true, slug, detail: detail.data, preflight: preflight.data };
}
