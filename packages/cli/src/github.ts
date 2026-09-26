import { strFromU8, unzipSync } from 'fflate';
import { isBinary, type PackageFile } from 'validator';
import { cappedFilter, OversizedArchiveError, unsafeEntryPath } from './install';
import type { RepoTarget } from './repo';

export const GITHUB_TIMEOUT_MS = 30_000;
// Abuse ceiling on the whole archive; a monorepo subpath legitimately carries
// far more than the kept-files caps allow. Same budget as the server.
export const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const USER_AGENT = 'skillpass-cli';
const SHA_RE = /^[0-9a-f]{7,40}$/;

export type CommitResult = { ok: true; sha: string } | { ok: false; message: string };

// Pins a target to a commit sha; HEAD resolves the default branch. Public
// GitHub only: no token, so a private repo reads as not found.
export async function resolveCommit(fetchImpl: typeof fetch, target: RepoTarget): Promise<CommitResult> {
	const ref = target.ref ?? 'HEAD';
	const url = `https://api.github.com/repos/${target.owner}/${target.repo}/commits/${encodeURIComponent(ref)}`;
	let res: Response;
	try {
		res = await fetchImpl(url, {
			headers: { Accept: 'application/vnd.github+json', 'User-Agent': USER_AGENT },
			signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
		});
	} catch {
		return { ok: false, message: `cannot reach GitHub at ${url}` };
	}
	if (res.status === 404) {
		return { ok: false, message: 'repository or ref not found, or the repository is private' };
	}
	// A 403 is only rate limiting when the quota is actually exhausted.
	if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) {
		return { ok: false, message: 'GitHub rate limit hit; try again shortly' };
	}
	if (!res.ok) {
		return { ok: false, message: `GitHub commit lookup failed (${res.status})` };
	}
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return { ok: false, message: 'unexpected GitHub commit response' };
	}
	const sha = typeof body === 'object' && body !== null ? (body as { sha?: unknown }).sha : undefined;
	if (typeof sha !== 'string' || !SHA_RE.test(sha)) {
		return { ok: false, message: 'unexpected GitHub commit response' };
	}
	return { ok: true, sha };
}

export interface RepoSnapshot {
	files: PackageFile[];
	// Paths left out because they are not text, reported as findings.
	binaries: string[];
}

export type SnapshotResult = { ok: true; snapshot: RepoSnapshot } | { ok: false; message: string };

// Reads a body in chunks and gives up as soon as it passes the budget, so an
// oversized archive is never buffered whole.
async function readCapped(stream: ReadableStream<Uint8Array>, cap: number): Promise<Uint8Array | undefined> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > cap) {
				await reader.cancel();
				return undefined;
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	return Buffer.concat(chunks);
}

// Downloads the commit's zip archive and extracts the package files, re-rooted
// at the subpath when one was given. Nothing here touches disk.
export async function fetchRepoFiles(
	fetchImpl: typeof fetch,
	target: RepoTarget,
	sha: string,
	maxArchiveBytes = MAX_ARCHIVE_BYTES,
): Promise<SnapshotResult> {
	const url = `https://codeload.github.com/${target.owner}/${target.repo}/zip/${encodeURIComponent(sha)}`;
	let res: Response;
	try {
		res = await fetchImpl(url, {
			headers: { 'User-Agent': USER_AGENT },
			signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
		});
	} catch {
		return { ok: false, message: `cannot reach GitHub at ${url}` };
	}
	if (res.status === 404) {
		return { ok: false, message: 'no archive for the pinned commit' };
	}
	if (!res.ok || !res.body) {
		return { ok: false, message: `GitHub archive download failed (${res.status})` };
	}
	const body = await readCapped(res.body, maxArchiveBytes);
	if (!body) {
		return {
			ok: false,
			message: `the repository archive exceeds the ${Math.round(maxArchiveBytes / 1024 / 1024)} MB download budget; nothing was installed`,
		};
	}
	return extractZip(body, target.subpath);
}

export function extractZip(body: Uint8Array, subpath?: string): SnapshotResult {
	const prefix = subpath === undefined ? '' : `${subpath}/`;
	// GitHub zips nest everything under "{repo}-{sha}/"; strip that root, then
	// keep only what sits under the subpath, re-rooted there.
	const relPath = (name: string): string | undefined => {
		const slash = name.indexOf('/');
		if (slash === -1 || name.endsWith('/')) return undefined;
		const rel = name.slice(slash + 1);
		if (!rel.startsWith(prefix)) return undefined;
		return rel.slice(prefix.length) || undefined;
	};
	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(body, { filter: cappedFilter((name) => relPath(name) !== undefined) });
	} catch (err) {
		if (err instanceof OversizedArchiveError) {
			return { ok: false, message: 'the repository exceeds the size caps; nothing was installed' };
		}
		return { ok: false, message: 'the repository archive was not a valid zip' };
	}
	const files: PackageFile[] = [];
	const binaries: string[] = [];
	for (const [name, data] of Object.entries(entries)) {
		const path = relPath(name) as string;
		if (unsafeEntryPath(path)) {
			return { ok: false, message: `refusing unsafe entry path "${path}" in the repository archive` };
		}
		if (isBinary(data)) binaries.push(path);
		else files.push({ path, content: strFromU8(data) });
	}
	if (files.length === 0) {
		return {
			ok: false,
			message:
				subpath === undefined
					? 'the repository has no text files at the pinned commit'
					: `no files under "${subpath}" at the pinned commit; point at the folder that contains SKILL.md`,
		};
	}
	return { ok: true, snapshot: { files, binaries } };
}
