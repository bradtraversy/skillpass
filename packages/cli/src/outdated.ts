import {
	publicPreflightSchema,
	publicSkillDetailSchema,
	publicSkillListSchema,
	type PublicSkillSummary,
} from 'skill-schema';
import { loadPackage } from 'validator';
import { getParsed, resolveApiUrl } from './api';
import { installedIn } from './list';
import { readReceipts } from './receipts';
import type { CommandResult } from './scan';
import { knownAreas } from './targets';
import { join } from 'node:path';

export interface OutdatedOptions {
	cwd?: string;
	home?: string;
	apiUrl?: string;
	fetchImpl?: typeof fetch;
}

// Best-effort identification of a pre-receipt single-skill install: its folder
// is byte-identical to some published snapshot, so its hash names its version.
export async function identifyByHash(
	fetchImpl: typeof fetch,
	apiUrl: string,
	slug: string,
	dir: string,
): Promise<string | undefined> {
	let hash: string;
	try {
		hash = loadPackage(dir).sourceHash;
	} catch {
		return undefined;
	}
	const detail = await getParsed(
		fetchImpl,
		`${apiUrl}/skills/${encodeURIComponent(slug)}`,
		publicSkillDetailSchema,
	);
	if (!detail.ok) {
		return undefined;
	}
	for (const version of detail.data.versions) {
		const preflight = await getParsed(
			fetchImpl,
			`${apiUrl}/skills/${encodeURIComponent(slug)}/${encodeURIComponent(version.version)}/preflight`,
			publicPreflightSchema,
		);
		if (preflight.ok && preflight.data.sourceHash === hash) {
			return version.version;
		}
	}
	return undefined;
}

// Exit codes: 0 everything current, 1 updates available (npm-style, the one
// command where 1 is not an error), 2 network/contract errors.
export async function runOutdated(opts: OutdatedOptions = {}): Promise<CommandResult> {
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	const apiUrl = resolveApiUrl(opts.apiUrl);
	const cwd = opts.cwd ?? process.cwd();

	const fetched = await getParsed(fetchImpl, `${apiUrl}/skills`, publicSkillListSchema);
	if (!fetched.ok) {
		return { lines: [`error: ${fetched.message}`], exitCode: 2 };
	}
	const latestBySlug = new Map<string, PublicSkillSummary>(fetched.data.map((s) => [s.slug, s]));

	const lines: string[] = [];
	let outdatedCount = 0;
	let tracked = 0;

	for (const area of knownAreas(cwd, opts.home)) {
		const names = installedIn(area.dir);
		if (names.length === 0) {
			continue;
		}
		const receipts = readReceipts(area.dir);
		const rows: string[] = [];
		const seenPacks = new Set<string>();
		let unrelated = 0;

		for (const name of names) {
			const receipt = receipts[name];
			if (receipt?.pack) {
				if (seenPacks.has(receipt.pack.slug)) {
					continue;
				}
				seenPacks.add(receipt.pack.slug);
				tracked += 1;
				const members = Object.values(receipts).filter(
					(r) => r.pack?.slug === receipt.pack?.slug,
				).length;
				const latest = latestBySlug.get(receipt.pack.slug)?.version;
				if (latest === undefined) {
					rows.push(`  ${receipt.pack.slug}  ${receipt.pack.version}  not in the directory`);
				} else if (latest === receipt.pack.version) {
					rows.push(`  ${receipt.pack.slug}  ${receipt.pack.version}  current (pack, ${members} skills)`);
				} else {
					outdatedCount += 1;
					rows.push(
						`  ${receipt.pack.slug}  ${receipt.pack.version} -> ${latest}  (pack, ${members} skills)`,
					);
				}
				continue;
			}
			if (receipt) {
				tracked += 1;
				const latest = latestBySlug.get(name)?.version;
				if (latest === undefined) {
					rows.push(`  ${name}  ${receipt.version}  not in the directory`);
				} else if (latest === receipt.version) {
					rows.push(`  ${name}  ${receipt.version}  current`);
				} else {
					outdatedCount += 1;
					rows.push(`  ${name}  ${receipt.version} -> ${latest}`);
				}
				continue;
			}
			// No receipt: a folder whose name is not even listed in the directory
			// is somebody's own skill, not our business - count it, don't nag.
			if (!latestBySlug.has(name)) {
				unrelated += 1;
				continue;
			}
			const identified = await identifyByHash(fetchImpl, apiUrl, name, join(area.dir, name));
			if (identified !== undefined) {
				tracked += 1;
				const latest = latestBySlug.get(name)?.version;
				if (latest === identified) {
					rows.push(`  ${name}  ${identified}  current (identified by hash)`);
				} else {
					outdatedCount += 1;
					rows.push(`  ${name}  ${identified} -> ${latest}  (identified by hash)`);
				}
				continue;
			}
			rows.push(`  ${name}  ?  no receipt - reinstall to track updates`);
		}

		if (rows.length > 0) {
			if (lines.length > 0) {
				lines.push('');
			}
			lines.push(area.label, ...rows);
			if (unrelated > 0) {
				lines.push(`  (${unrelated} folder(s) not from the directory)`);
			}
		}
	}

	if (tracked === 0 && lines.length === 0) {
		return { lines: ['No skills installed in the known install areas.'], exitCode: 0 };
	}
	lines.push(
		'',
		outdatedCount === 0
			? 'Everything is current.'
			: `${outdatedCount} update(s) available - skillpass update <slug>`,
	);
	return { lines, exitCode: outdatedCount === 0 ? 0 : 1 };
}
