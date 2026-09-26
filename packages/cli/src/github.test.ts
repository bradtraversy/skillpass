import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { extractZip, fetchRepoFiles, resolveCommit } from './github';

const SHA = 'a'.repeat(40);
const TARGET = { owner: 'o', repo: 'r' };

function zipOf(entries: Record<string, string | Uint8Array>): Uint8Array {
	return zipSync(
		Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])),
	);
}

function commitFetch(status: number, body: unknown = { sha: SHA }, headers: Record<string, string> = {}) {
	return vi.fn(async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;
}

describe('resolveCommit', () => {
	it('reads the sha and asks for HEAD when no ref was given', async () => {
		const fetchImpl = commitFetch(200);
		expect(await resolveCommit(fetchImpl, TARGET)).toEqual({ ok: true, sha: SHA });
		const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.github.com/repos/o/r/commits/HEAD');
		expect((init.headers as Record<string, string>)['User-Agent']).toBe('skillpass-cli');
	});

	it('encodes the ref', async () => {
		const fetchImpl = commitFetch(200);
		await resolveCommit(fetchImpl, { ...TARGET, ref: 'v1.2.0' });
		expect(String(vi.mocked(fetchImpl).mock.calls[0][0])).toBe('https://api.github.com/repos/o/r/commits/v1.2.0');
	});

	it.each([
		[404, {}, 'repository or ref not found, or the repository is private'],
		[429, {}, 'GitHub rate limit hit; try again shortly'],
		[403, { 'x-ratelimit-remaining': '0' }, 'GitHub rate limit hit; try again shortly'],
		[403, { 'x-ratelimit-remaining': '12' }, 'GitHub commit lookup failed (403)'],
		[500, {}, 'GitHub commit lookup failed (500)'],
	])('maps status %s', async (status, headers, message) => {
		expect(await resolveCommit(commitFetch(status, { message: 'x' }, headers), TARGET)).toEqual({ ok: false, message });
	});

	it('reports a network failure', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error('offline');
		}) as unknown as typeof fetch;
		const result = await resolveCommit(fetchImpl, TARGET);
		expect(result).toEqual({
			ok: false,
			message: 'cannot reach GitHub at https://api.github.com/repos/o/r/commits/HEAD',
		});
	});

	it('rejects a response without a sha', async () => {
		expect(await resolveCommit(commitFetch(200, { sha: 'not hex' }), TARGET)).toEqual({
			ok: false,
			message: 'unexpected GitHub commit response',
		});
	});
});

describe('extractZip', () => {
	it('strips the archive root and skips directory entries', () => {
		const zip = zipOf({
			[`r-${SHA}/`]: '',
			[`r-${SHA}/SKILL.md`]: '# hi\n',
			[`r-${SHA}/docs/`]: '',
			[`r-${SHA}/docs/a.md`]: 'a\n',
		});
		expect(extractZip(zip)).toEqual({
			ok: true,
			snapshot: {
				files: [
					{ path: 'SKILL.md', content: '# hi\n' },
					{ path: 'docs/a.md', content: 'a\n' },
				],
				binaries: [],
			},
		});
	});

	it('re-roots at the subpath and leaves the rest of the repo out', () => {
		const zip = zipOf({
			[`r-${SHA}/README.md`]: 'root\n',
			[`r-${SHA}/skills/pdf/SKILL.md`]: '# pdf\n',
			[`r-${SHA}/skills/pdf/ref/notes.md`]: 'notes\n',
			[`r-${SHA}/skills/pdfx/SKILL.md`]: '# other\n',
		});
		const result = extractZip(zip, 'skills/pdf');
		expect(result.ok && result.snapshot.files.map((f) => f.path)).toEqual(['SKILL.md', 'ref/notes.md']);
	});

	it('errors on an empty subpath with the SKILL.md hint', () => {
		const zip = zipOf({ [`r-${SHA}/SKILL.md`]: '# hi\n' });
		expect(extractZip(zip, 'nope')).toEqual({
			ok: false,
			message: 'no files under "nope" at the pinned commit; point at the folder that contains SKILL.md',
		});
		expect(extractZip(zipOf({ [`r-${SHA}/`]: '' }))).toEqual({
			ok: false,
			message: 'the repository has no text files at the pinned commit',
		});
	});

	it('drops binaries and lists them', () => {
		const zip = zipOf({ [`r-${SHA}/SKILL.md`]: '# hi\n', [`r-${SHA}/logo.png`]: new Uint8Array([0, 1, 2, 255]) });
		const result = extractZip(zip);
		expect(result.ok && result.snapshot.binaries).toEqual(['logo.png']);
		expect(result.ok && result.snapshot.files.map((f) => f.path)).toEqual(['SKILL.md']);
	});

	it('refuses a path-traversal entry', () => {
		const zip = zipOf({ [`r-${SHA}/../evil.md`]: 'x' });
		expect(extractZip(zip)).toEqual({
			ok: false,
			message: 'refusing unsafe entry path "../evil.md" in the repository archive',
		});
	});

	it('trips the file-count cap on kept files only', () => {
		const many = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`r-${SHA}/f${i}.md`, 'x']));
		expect(extractZip(zipOf(many))).toEqual({
			ok: false,
			message: 'the repository exceeds the size caps; nothing was installed',
		});
		const outside = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`r-${SHA}/other/f${i}.md`, 'x']));
		const result = extractZip(zipOf({ ...outside, [`r-${SHA}/mine/SKILL.md`]: '# mine\n' }), 'mine');
		expect(result.ok).toBe(true);
	});

	it('trips the per-file and total caps', () => {
		const big = zipOf({ [`r-${SHA}/big.md`]: 'a'.repeat(1024 * 1024 + 1) });
		expect(extractZip(big).ok).toBe(false);
		const total = Object.fromEntries(
			Array.from({ length: 11 }, (_, i) => [`r-${SHA}/f${i}.md`, 'a'.repeat(1_000_000)]),
		);
		expect(extractZip(zipOf(total))).toEqual({
			ok: false,
			message: 'the repository exceeds the size caps; nothing was installed',
		});
	});

	it('rejects a body that is not a zip', () => {
		expect(extractZip(strToU8('nope'))).toEqual({ ok: false, message: 'the repository archive was not a valid zip' });
	});
});

describe('fetchRepoFiles', () => {
	const zip = zipOf({ [`r-${SHA}/SKILL.md`]: '# hi\n' });

	it('downloads the codeload zip for the sha', async () => {
		const fetchImpl = vi.fn(async () => new Response(zip.slice().buffer, { status: 200 })) as unknown as typeof fetch;
		const result = await fetchRepoFiles(fetchImpl, TARGET, SHA);
		expect(result.ok && result.snapshot.files).toEqual([{ path: 'SKILL.md', content: '# hi\n' }]);
		expect(String(vi.mocked(fetchImpl).mock.calls[0][0])).toBe(`https://codeload.github.com/o/r/zip/${SHA}`);
	});

	it('stops reading past the archive budget', async () => {
		const fetchImpl = vi.fn(async () => new Response(zip.slice().buffer, { status: 200 })) as unknown as typeof fetch;
		expect(await fetchRepoFiles(fetchImpl, TARGET, SHA, 10)).toEqual({
			ok: false,
			message: 'the repository archive exceeds the 0 MB download budget; nothing was installed',
		});
	});

	it.each([
		[404, 'no archive for the pinned commit'],
		[502, 'GitHub archive download failed (502)'],
	])('maps status %s', async (status, message) => {
		const fetchImpl = vi.fn(async () => new Response('x', { status })) as unknown as typeof fetch;
		expect(await fetchRepoFiles(fetchImpl, TARGET, SHA)).toEqual({ ok: false, message });
	});

	it('reports a network failure', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error('offline');
		}) as unknown as typeof fetch;
		const result = await fetchRepoFiles(fetchImpl, TARGET, SHA);
		expect(result).toEqual({ ok: false, message: `cannot reach GitHub at https://codeload.github.com/o/r/zip/${SHA}` });
	});
});
