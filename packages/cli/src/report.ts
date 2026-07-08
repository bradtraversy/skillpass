import {
	publicPreflightSchema,
	publicSkillDetailSchema,
	type PublicPreflight,
	type PublicSkillDetail,
} from 'skill-schema';
import { renderDiff, renderPermissions, statusLabel } from './render';
import type { CommandResult } from './scan';

export const DEFAULT_API_URL = 'http://localhost:8787';

export interface ReportOptions {
	json?: boolean;
	apiUrl?: string;
	fetchImpl?: typeof fetch;
}

export function parseSkillRef(ref: string): { slug: string; version?: string } {
	const at = ref.indexOf('@');
	return at === -1 ? { slug: ref } : { slug: ref.slice(0, at), version: ref.slice(at + 1) };
}

type FetchOutcome<T> =
	| { ok: true; data: T }
	| { ok: false; notFound: boolean; message: string };

// Structural subset of a zod schema, so the CLI needs no direct zod dependency.
interface ContractSchema<T> {
	safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

async function getParsed<T>(
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

function renderReport(detail: PublicSkillDetail, preflight: PublicPreflight): string[] {
	const attribution = detail.attributedTo ? ` (curated from ${detail.attributedTo})` : '';
	const lines = [
		`Skill     ${detail.name} by ${detail.maintainer}${attribution}`,
		`Version   ${preflight.version}`,
		`Status    ${statusLabel(preflight.validationStatus)}`,
		`Risk      ${preflight.riskLevel}`,
		`Source    ${preflight.sourceHash} ${preflight.sourceVerified ? '(verified)' : '(HASH MISMATCH)'}`,
		`Generated ${preflight.generatedAt.slice(0, 10)}`,
		'',
		...renderPermissions(preflight.permissions.declared, preflight.permissions.detected),
		'',
		...renderDiff(preflight.diff),
	];
	if (preflight.blocked) {
		lines.push('', `BLOCKED: ${preflight.blockedReason ?? 'this version cannot be downloaded'}`);
	}
	return lines;
}

// Exit codes are contract: 0 ok, 1 blocked version, 2 not found/network/API errors.
export async function runReport(ref: string, opts: ReportOptions = {}): Promise<CommandResult> {
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	const apiUrl = (opts.apiUrl ?? process.env.AISKILLS_API ?? DEFAULT_API_URL).replace(/\/$/, '');
	const { slug, version } = parseSkillRef(ref);
	if (!slug || version === '') {
		return { lines: [`error: invalid skill reference "${ref}"`], exitCode: 2 };
	}

	const detailPath = version
		? `/skills/${encodeURIComponent(slug)}/${encodeURIComponent(version)}`
		: `/skills/${encodeURIComponent(slug)}`;
	const detail = await getParsed(fetchImpl, `${apiUrl}${detailPath}`, publicSkillDetailSchema);
	if (!detail.ok) {
		return detail.notFound
			? {
					lines: [`error: ${version ? `${slug}@${version}` : slug} is not published on the directory`],
					exitCode: 2,
				}
			: { lines: [`error: ${detail.message}`], exitCode: 2 };
	}

	const pinned = version ?? detail.data.version;
	const preflight = await getParsed(
		fetchImpl,
		`${apiUrl}/skills/${encodeURIComponent(slug)}/${encodeURIComponent(pinned)}/preflight`,
		publicPreflightSchema,
	);
	if (!preflight.ok) {
		return { lines: [`error: ${preflight.message}`], exitCode: 2 };
	}

	const exitCode = preflight.data.blocked ? 1 : 0;
	if (opts.json) {
		return { lines: [JSON.stringify(preflight.data, null, 2)], exitCode };
	}
	return { lines: renderReport(detail.data, preflight.data), exitCode };
}
