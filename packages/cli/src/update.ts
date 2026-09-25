import { existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { publicPreflightSchema, type PublicPreflight, type PublicSkillDetail } from 'skill-schema';
import { downloadVerified, writeTree } from './add';
import { confirmRisk, createOutput, GLOBAL_NEEDS_TARGET, isOccupied, planMembers, receiptFor } from './install';
import { resolvePackMembers } from './pack';
import { fetchPreflight, getParsed, parseSkillRef, resolveApiUrl } from './api';
import { identifyByHash } from './outdated';
import { readReceipts, recordReceipt, removeReceipt } from './receipts';
import { renderPreflightReport } from './render';
import type { CommandResult } from './scan';
import { PLAIN, type Styler } from './style';
import { knownAreas, type KnownArea } from './targets';

export interface UpdateOptions {
	yes?: boolean;
	target?: string;
	global?: boolean;
	cwd?: string;
	home?: string;
	apiUrl?: string;
	fetchImpl?: typeof fetch;
	confirmImpl?: (question: string) => Promise<boolean>;
	style?: Styler;
	emit?: (text: string) => void;
}

interface Located {
	area: KnownArea;
	dir: string;
	installedVersion?: string;
	packSlug?: string;
}

async function locate(slug: string, opts: UpdateOptions, fetchImpl: typeof fetch, apiUrl: string): Promise<Located[]> {
	const cwd = opts.cwd ?? process.cwd();
	let areas = knownAreas(cwd, opts.home);
	if (opts.target) {
		areas = areas.filter((a) => a.tools.includes(opts.target as string) && (opts.global ? a.global : a.project));
	}
	const hits: Located[] = [];
	for (const area of areas) {
		const receipts = readReceipts(area.dir);
		const receipt = receipts[slug];
		const dir = join(area.dir, slug);
		if (receipt) {
			hits.push({
				area,
				dir,
				installedVersion: receipt.version,
				packSlug: receipt.pack?.slug,
			});
			continue;
		}
		const packMember = Object.values(receipts).find((r) => r.pack?.slug === slug);
		if (packMember?.pack) {
			// The ref names a pack: its install is the member family in this area.
			hits.push({ area, dir: area.dir, installedVersion: packMember.pack.version, packSlug: slug });
			continue;
		}
		if (existsSync(dir)) {
			const identified = await identifyByHash(fetchImpl, apiUrl, slug, dir);
			if (identified !== undefined) {
				hits.push({ area, dir, installedVersion: identified });
			}
		}
	}
	return hits;
}

interface PermissionSets {
	declared: string[];
	detected: string[];
}

// Diff computed against what is actually installed - the API's stored diff
// only covers the previous publish.
export function permissionChanges(
	installed: PermissionSets,
	target: PermissionSets,
): { added: string[]; removed: string[] } {
	const flat = (sets: PermissionSets) => new Set([...sets.declared, ...sets.detected]);
	const before = flat(installed);
	const after = flat(target);
	return {
		added: [...after].filter((key) => !before.has(key)).sort(),
		removed: [...before].filter((key) => !after.has(key)).sort(),
	};
}

// Replace the installed tree only after the new one is fully on disk; any
// failure puts the old folder back and removes the half-built one. A receipted
// folder the user deleted by hand has nothing to set aside and installs fresh.
export function swapTree(files: { path: string; content: string }[], dir: string): void {
	const fresh = `${dir}.new-${process.pid}`;
	const aside = `${dir}.old-${process.pid}`;
	rmSync(fresh, { recursive: true, force: true });
	writeTree(files, fresh);
	try {
		if (existsSync(dir)) renameSync(dir, aside);
		renameSync(fresh, dir);
	} catch (err) {
		if (existsSync(aside) && !existsSync(dir)) renameSync(aside, dir);
		rmSync(fresh, { recursive: true, force: true });
		throw err;
	}
	rmSync(aside, { recursive: true, force: true });
}

export async function runUpdate(ref: string, opts: UpdateOptions = {}): Promise<CommandResult> {
	const { push, done } = createOutput(opts.emit);
	const st = opts.style ?? PLAIN;

	if (opts.global && !opts.target) {
		push(GLOBAL_NEEDS_TARGET);
		return done(2);
	}
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	const apiUrl = resolveApiUrl(opts.apiUrl);
	const { slug } = parseSkillRef(ref);
	if (!slug) {
		push(`error: invalid skill reference "${ref}"`);
		return done(2);
	}

	const hits = await locate(slug, opts, fetchImpl, apiUrl);
	const memberHit = hits.find((h) => h.packSlug !== undefined && h.packSlug !== slug);
	if (memberHit?.packSlug !== undefined) {
		push(`error: ${slug} is part of the ${memberHit.packSlug} pack; run skillpass update ${memberHit.packSlug}`);
		return done(2);
	}
	if (hits.length === 0) {
		push(
			`error: ${slug} is not installed in a known skills area (only receipted or hash-identifiable installs can update)`,
		);
		return done(2);
	}
	if (hits.length > 1) {
		push(
			`error: ${slug} is installed in more than one place; pick one with --target [--global]:`,
			...hits.map((h) => `  ${h.dir}`),
		);
		return done(2);
	}
	const installed = hits[0];

	const fetched = await fetchPreflight(fetchImpl, apiUrl, ref);
	if (!fetched.ok) {
		push(...fetched.result.lines);
		return done(fetched.result.exitCode);
	}
	const { detail, preflight } = fetched;
	if ((detail.packMembers?.length ?? 0) > 0 || installed.packSlug === slug) {
		return runPackUpdate(slug, installed, detail, preflight, opts, fetchImpl, apiUrl, st, push, done);
	}

	if (installed.installedVersion === preflight.version) {
		push(`${slug} is already at ${preflight.version}.`);
		return done(0);
	}

	push(...renderPreflightReport(detail, preflight, opts.style));
	push('', ...(await changesVsInstalled(fetchImpl, apiUrl, slug, installed, preflight, st)));
	if (preflight.blocked) {
		return done(1);
	}
	const confirmed = await confirmRisk(
		preflight,
		opts,
		`Update ${slug} to ${preflight.version} (${preflight.riskLevel} risk)? [y/N] `,
		'Update aborted; the installed version was left in place.',
		push,
	);
	if (!confirmed) return done(2);

	const download = await downloadVerified(fetchImpl, apiUrl, slug, preflight.version, preflight.sourceHash);
	if (!download.ok) {
		push('', `error: ${download.message}`);
		return done(2);
	}
	try {
		swapTree(download.files, installed.dir);
	} catch {
		push('', 'error: could not replace the install; the installed version was left in place');
		return done(2);
	}
	recordReceipt(installed.area.dir, slug, receiptFor(preflight));
	push(
		'',
		`Updated ${slug} ${installed.installedVersion ?? '?'} -> ${preflight.version} in ${installed.dir}`,
		'Source hash verified against the Skill Passport.',
	);
	return done(0);
}

async function changesVsInstalled(
	fetchImpl: typeof fetch,
	apiUrl: string,
	slug: string,
	installed: Located,
	target: PublicPreflight,
	st: Styler,
): Promise<string[]> {
	if (installed.installedVersion === undefined) {
		return ['Changes vs installed: unknown (no version identified)'];
	}
	const before = await getParsed(
		fetchImpl,
		`${apiUrl}/skills/${encodeURIComponent(slug)}/${encodeURIComponent(installed.installedVersion)}/preflight`,
		publicPreflightSchema,
	);
	if (!before.ok) {
		return [`Changes vs installed v${installed.installedVersion}: unavailable (that version is no longer published)`];
	}
	const { added, removed } = permissionChanges(before.data.permissions, target.permissions);
	if (added.length === 0 && removed.length === 0) {
		return [`Changes vs installed v${installed.installedVersion}: no permission changes`];
	}
	return [
		`Changes vs installed v${installed.installedVersion}`,
		...added.map((key) => st.red(`  + ${key} (new)`)),
		...removed.map((key) => `  - ${key} (no longer requested)`),
	];
}

// Pack update: swap changed members, install added ones, remove dropped ones,
// all against one verified snapshot download.
async function runPackUpdate(
	slug: string,
	installed: Located,
	detail: PublicSkillDetail,
	preflight: PublicPreflight,
	opts: UpdateOptions,
	fetchImpl: typeof fetch,
	apiUrl: string,
	st: Styler,
	push: (...next: string[]) => void,
	done: (exitCode: number) => CommandResult,
): Promise<CommandResult> {
	if (installed.packSlug !== slug) {
		push(`error: ${slug} is a pack but this install is not tracked as one; reinstall with skillpass add`);
		return done(2);
	}
	if (installed.installedVersion === preflight.version) {
		push(`${slug} is already at ${preflight.version}.`);
		return done(0);
	}
	push(...renderPreflightReport(detail, preflight, opts.style));
	push('', ...(await changesVsInstalled(fetchImpl, apiUrl, slug, installed, preflight, st)));
	if (preflight.blocked) {
		return done(1);
	}
	const confirmed = await confirmRisk(
		preflight,
		opts,
		`Update ${slug} to ${preflight.version} (${preflight.riskLevel} risk)? [y/N] `,
		'Update aborted; the installed version was left in place.',
		push,
	);
	if (!confirmed) return done(2);

	const areaDir = installed.area.dir;
	const tool = opts.target ?? installed.area.tools[0];
	const { installs, skipped } = resolvePackMembers(detail.packMembers ?? [], installed.area.layout);
	if (installs.length === 0) {
		push('', `error: none of the new version's skills support ${tool}`);
		return done(2);
	}
	const receipts = readReceipts(areaDir);
	const currentMembers = Object.entries(receipts)
		.filter(([, r]) => r.pack?.slug === slug)
		.map(([name]) => name);
	const newNames = new Set(installs.map((m) => m.name));
	const toRemove = currentMembers.filter((name) => !newNames.has(name));
	const additions = installs.filter((m) => !currentMembers.includes(m.name));

	const conflicts = additions.map((m) => join(areaDir, m.name)).filter(isOccupied);
	if (conflicts.length > 0) {
		push(
			'',
			'error: these destinations already exist and are not empty; nothing was changed:',
			...conflicts.map((c) => `  ${c}`),
		);
		return done(2);
	}

	const download = await downloadVerified(fetchImpl, apiUrl, slug, preflight.version, preflight.sourceHash);
	if (!download.ok) {
		push('', `error: ${download.message}`);
		return done(2);
	}
	const plans = planMembers(installs, download.files);
	const missing = plans.find((p) => p.files.length === 0);
	if (missing) {
		push('', `error: the snapshot has no files for "${missing.name}"; nothing was changed`);
		return done(2);
	}
	for (const name of skipped) {
		push('', `note: ${name} does not support ${tool}; skipped`);
	}

	const done1: string[] = [];
	try {
		for (const plan of plans) {
			const dest = join(areaDir, plan.name);
			if (existsSync(dest)) {
				swapTree(plan.files, dest);
			} else {
				writeTree(plan.files, dest);
			}
			done1.push(plan.name);
			recordReceipt(areaDir, plan.name, receiptFor(preflight, slug));
		}
	} catch {
		push(
			'',
			`error: could not write ${plans[done1.length].name}; updated before the failure: ${done1.join(', ') || 'none'}`,
		);
		return done(2);
	}
	for (const name of toRemove) {
		rmSync(join(areaDir, name), { recursive: true, force: true });
		removeReceipt(areaDir, name);
	}

	push(
		'',
		`Updated ${slug} ${installed.installedVersion ?? '?'} -> ${preflight.version} in ${areaDir}`,
		`  ${done1.length} skill(s)${additions.length > 0 ? `, added: ${additions.map((m) => m.name).join(', ')}` : ''}${toRemove.length > 0 ? `, removed: ${toRemove.join(', ')}` : ''}`,
		'Source hash verified against the Skill Passport.',
	);
	return done(0);
}
