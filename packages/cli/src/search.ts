import { CATEGORY_SLUGS, TARGETS, publicSkillListSchema, type PublicSkillSummary } from 'skill-schema';
import { getParsed, resolveApiUrl, type FetchOutcome } from './api';
import { riskColor } from './render';
import type { CommandResult } from './scan';
import { PLAIN, type Styler } from './style';

export interface SearchOptions {
	query?: string;
	target?: string;
	category?: string;
	packs?: boolean;
	// Search by meaning through the directory's AI search endpoint.
	ai?: boolean;
	json?: boolean;
	// Terminal width when stdout is a TTY; absent (piped) means full rows.
	width?: number;
	style?: Styler;
	apiUrl?: string;
	fetchImpl?: typeof fetch;
}

// The site's haystack (apps/web/src/lib/filterSkills.ts) plus attributedTo:
// curated rows display the source repo owner as the author, so that name must
// be searchable too.
function matchesQuery(skill: PublicSkillSummary, query: string): boolean {
	return [
		skill.name,
		skill.summary,
		skill.maintainer,
		skill.attributedTo ?? '',
		...skill.targets,
		...(skill.packSkills ?? []),
	]
		.join(' ')
		.toLowerCase()
		.includes(query);
}

function packMarker(skill: PublicSkillSummary): string {
	const count = skill.packSkills?.length ?? 0;
	return count > 0 ? `PACK ${count}` : '';
}

// Low is the default state and stays silent; only elevated risk earns a
// marker, so the rare risky row is the one that stands out.
function riskMarker(skill: PublicSkillSummary): string {
	return skill.riskLevel === 'low' ? '' : skill.riskLevel;
}

interface ColumnWidths {
	slug: number;
	risk: number;
	pack: number;
	author: number;
}

function columnWidths(matches: PublicSkillSummary[]): ColumnWidths {
	return {
		slug: Math.max(...matches.map((s) => s.slug.length)),
		risk: Math.max(...matches.map((s) => riskMarker(s).length)),
		pack: Math.max(...matches.map((s) => packMarker(s).length)),
		author: Math.max(...matches.map((s) => (s.attributedTo ?? s.maintainer).length)),
	};
}

// Styling wraps already-padded plain text, so alignment math never sees
// escape codes. A column nobody in the result set uses collapses entirely.
function row(skill: PublicSkillSummary, w: ColumnWidths, st: Styler): string {
	const author = skill.attributedTo ?? skill.maintainer;
	const tagline = skill.tagline ?? skill.summary;
	const cell = (text: string, width: number, style: (text: string) => string) =>
		width === 0 ? [] : [style(text.padEnd(width))];
	return [
		st.bold(skill.slug.padEnd(w.slug)),
		...cell(riskMarker(skill), w.risk, riskColor(st, skill.riskLevel)),
		...cell(packMarker(skill), w.pack, st.cyan),
		st.yellow(author.padEnd(w.author)),
		tagline,
	].join('  ');
}

function truncate(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 3))}...`;
}

// Two lines per skill for terminals too narrow for the aligned table: a short
// unpadded header, then the tagline truncated to the width.
function narrowRows(skill: PublicSkillSummary, width: number, st: Styler): string[] {
	const author = skill.attributedTo ?? skill.maintainer;
	const pack = packMarker(skill);
	const risk = riskMarker(skill);
	const header = [
		st.bold(skill.slug),
		...(risk === '' ? [] : [riskColor(st, skill.riskLevel)(risk)]),
		...(pack === '' ? [] : [st.cyan(pack)]),
		st.yellow(author),
	].join('  ');
	return [header, st.dim(`  ${truncate(skill.tagline ?? skill.summary, width - 2)}`)];
}

function renderRows(matches: PublicSkillSummary[], width: number | undefined, st: Styler): string[] {
	const w = columnWidths(matches);
	const fits = width === undefined || matches.every((skill) => row(skill, w, PLAIN).length <= width);
	if (fits) {
		return matches.map((skill) => row(skill, w, st).trimEnd());
	}
	return matches.flatMap((skill, i) =>
		i === 0 ? narrowRows(skill, width, st) : ['', ...narrowRows(skill, width, st)],
	);
}

// Exit codes are contract: 0 results or a clean empty match, 2 usage/network/
// contract errors. An empty result is an answer, not an error.
export async function runSearch(opts: SearchOptions = {}): Promise<CommandResult> {
	if (opts.target && !(TARGETS as readonly string[]).includes(opts.target)) {
		return {
			lines: [`error: unknown target "${opts.target}" (known tools: ${TARGETS.join(', ')})`],
			exitCode: 2,
		};
	}
	if (opts.category && !(CATEGORY_SLUGS as readonly string[]).includes(opts.category)) {
		return {
			lines: [`error: unknown category "${opts.category}" (known categories: ${CATEGORY_SLUGS.join(', ')})`],
			exitCode: 2,
		};
	}

	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	const apiUrl = resolveApiUrl(opts.apiUrl);
	if (opts.ai) {
		return runAiSearch(opts, fetchImpl, apiUrl);
	}
	const fetched = await getParsed(fetchImpl, `${apiUrl}/skills`, publicSkillListSchema);
	if (!fetched.ok) {
		return { lines: [`error: ${fetched.message}`], exitCode: 2 };
	}

	const query = (opts.query ?? '').trim().toLowerCase();
	const matches = fetched.data.filter(
		(skill) => matchesFilters(skill, opts) && (query === '' || matchesQuery(skill, query)),
	);

	if (opts.json) {
		return { lines: [JSON.stringify(matches, null, 2)], exitCode: 0 };
	}
	if (matches.length === 0) {
		return { lines: [`No skills match - ${fetched.data.length} listed at skillpass.dev`], exitCode: 0 };
	}

	const st = opts.style ?? PLAIN;
	return {
		lines: [
			...renderRows(matches, opts.width, st),
			'',
			st.dim(`${matches.length} of ${fetched.data.length} skills - skillpass report <slug> shows the passport`),
		],
		exitCode: 0,
	};
}

function matchesFilters(skill: PublicSkillSummary, opts: SearchOptions): boolean {
	if (opts.target && !(skill.targets as string[]).includes(opts.target)) return false;
	if (opts.category && (skill.category ?? null) !== opts.category) return false;
	if (opts.packs && (skill.packSkills?.length ?? 0) === 0) return false;
	return true;
}

const AI_ERRORS: Record<number, string> = {
	429: 'AI search is rate limited (20 requests a minute per address); try again in a moment',
	503: 'AI search is not configured on this API',
	502: 'AI search is temporarily unavailable; try again shortly',
};

function aiErrorMessage(outcome: Extract<FetchOutcome<unknown>, { ok: false }>): string {
	if (outcome.status !== undefined && AI_ERRORS[outcome.status]) return AI_ERRORS[outcome.status];
	if (outcome.status === 400 && outcome.apiError) return outcome.apiError;
	return outcome.message;
}

// Results arrive ranked by the server; filters narrow them without re-sorting,
// the same way the site applies its sidebar filters to AI results.
async function runAiSearch(opts: SearchOptions, fetchImpl: typeof fetch, apiUrl: string): Promise<CommandResult> {
	const query = (opts.query ?? '').trim();
	if (query === '') {
		return { lines: ['error: search --ai needs a query (describe what you need)'], exitCode: 2 };
	}
	const fetched = await getParsed(
		fetchImpl,
		`${apiUrl}/skills/search?q=${encodeURIComponent(query)}`,
		publicSkillListSchema,
	);
	if (!fetched.ok) {
		return { lines: [`error: ${aiErrorMessage(fetched)}`], exitCode: 2 };
	}
	const matches = fetched.data.filter((skill) => matchesFilters(skill, opts));
	if (opts.json) {
		return { lines: [JSON.stringify(matches, null, 2)], exitCode: 0 };
	}
	if (matches.length === 0) {
		return { lines: ['No skills match by meaning - try other words'], exitCode: 0 };
	}
	const st = opts.style ?? PLAIN;
	return {
		lines: [
			...renderRows(matches, opts.width, st),
			'',
			st.dim(`${matches.length} skills by meaning - skillpass report <slug> shows the passport`),
		],
		exitCode: 0,
	};
}
