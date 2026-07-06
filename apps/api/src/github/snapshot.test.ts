import { gzipSync } from 'node:zlib';
import { pack } from 'tar-stream';
import { loadPackageFromFiles } from 'validator';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../env';
import { RAW_TEST_ENV } from '../testing/env';
import { extractTarball, fetchSnapshot, MAX_FILE_BYTES, MAX_FILES } from './snapshot';

interface TarEntry {
	name: string;
	content?: string;
	type?: 'directory' | 'symlink';
}

async function makeTarGz(entries: TarEntry[]): Promise<Buffer> {
	const p = pack();
	for (const e of entries) {
		if (e.type === 'symlink') p.entry({ name: e.name, type: 'symlink', linkname: 'target' });
		else if (e.type === 'directory') p.entry({ name: e.name, type: 'directory' });
		else p.entry({ name: e.name }, e.content ?? '');
	}
	p.finalize();
	const chunks: Buffer[] = [];
	for await (const c of p) chunks.push(c as Buffer);
	return gzipSync(Buffer.concat(chunks));
}

const asBody = (buf: Buffer) => {
	const body = new Response(new Uint8Array(buf)).body;
	if (!body) throw new Error('no body');
	return body;
};

describe('extractTarball', () => {
	it('strips the root dir, skips non-files, and returns sorted utf8 files', async () => {
		const tar = await makeTarGz([
			{ name: 'repo-abc123', type: 'directory' },
			{ name: 'repo-abc123/skill.json', content: '{"name":"demo"}' },
			{ name: 'repo-abc123/SKILL.md', content: '# Demo\n' },
			{ name: 'repo-abc123/docs/notes.md', content: 'notes' },
			{ name: 'repo-abc123/link', type: 'symlink' },
		]);
		const result = await extractTarball(asBody(tar));
		expect(result).toEqual({
			success: true,
			data: [
				{ path: 'SKILL.md', content: '# Demo\n' },
				{ path: 'docs/notes.md', content: 'notes' },
				{ path: 'skill.json', content: '{"name":"demo"}' },
			],
		});
	});

	it('re-roots files under the subpath and drops the rest', async () => {
		const tar = await makeTarGz([
			{ name: 'repo-abc/README.md', content: 'root readme' },
			{ name: 'repo-abc/skills/plan/SKILL.md', content: '# Plan' },
			{ name: 'repo-abc/skills/plan/helper.md', content: 'help' },
		]);
		const result = await extractTarball(asBody(tar), 'skills/plan');
		expect(result).toEqual({
			success: true,
			data: [
				{ path: 'SKILL.md', content: '# Plan' },
				{ path: 'helper.md', content: 'help' },
			],
		});
	});

	it('produces the same validator source hash on repeat extractions', async () => {
		const tar = await makeTarGz([
			{ name: 'repo-abc/SKILL.md', content: '# Demo\n' },
			{ name: 'repo-abc/skill.json', content: '{"name":"demo"}' },
		]);
		const first = await extractTarball(asBody(tar));
		const second = await extractTarball(asBody(tar));
		if (!first.success || !second.success) throw new Error('expected success');
		expect(loadPackageFromFiles(first.data).sourceHash).toBe(
			loadPackageFromFiles(second.data).sourceHash,
		);
	});

	it('rejects a path-traversal entry', async () => {
		const tar = await makeTarGz([{ name: 'repo-abc/../evil.md', content: 'x' }]);
		const result = await extractTarball(asBody(tar));
		expect(result).toMatchObject({ success: false, code: 'bad-archive' });
	});

	it('rejects a file over the per-file cap', async () => {
		const tar = await makeTarGz([
			{ name: 'repo-abc/big.md', content: 'a'.repeat(MAX_FILE_BYTES + 1) },
		]);
		const result = await extractTarball(asBody(tar));
		expect(result).toMatchObject({ success: false, code: 'too-large' });
	});

	it('rejects a package over the file-count cap', async () => {
		const entries = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({
			name: `repo-abc/f${i}.md`,
			content: 'x',
		}));
		const result = await extractTarball(asBody(await makeTarGz(entries)));
		expect(result).toMatchObject({ success: false, code: 'too-large' });
	});

	it('rejects a package over the total-bytes cap', async () => {
		const entries = Array.from({ length: 11 }, (_, i) => ({
			name: `repo-abc/f${i}.md`,
			content: 'a'.repeat(MAX_FILE_BYTES),
		}));
		const result = await extractTarball(asBody(await makeTarGz(entries)));
		expect(result).toMatchObject({ success: false, code: 'too-large' });
	});

	it('rejects an empty repository', async () => {
		const tar = await makeTarGz([{ name: 'repo-abc', type: 'directory' }]);
		const result = await extractTarball(asBody(tar));
		expect(result).toMatchObject({ success: false, code: 'empty-package' });
	});

	it('rejects a subpath that matches nothing', async () => {
		const tar = await makeTarGz([{ name: 'repo-abc/SKILL.md', content: '# Demo' }]);
		const result = await extractTarball(asBody(tar), 'skills/missing');
		expect(result).toMatchObject({ success: false, code: 'empty-package' });
	});

	it('rejects a corrupt archive', async () => {
		const result = await extractTarball(asBody(Buffer.from('definitely not gzip')));
		expect(result).toMatchObject({ success: false, code: 'bad-archive' });
	});
});

describe('fetchSnapshot', () => {
	const env = loadEnv(RAW_TEST_ENV);

	afterEach(() => vi.unstubAllGlobals());

	it('downloads the pinned tarball and extracts it', async () => {
		const tar = await makeTarGz([{ name: 'repo-abc/SKILL.md', content: '# Demo' }]);
		const fn = vi.fn().mockResolvedValue(new Response(new Uint8Array(tar), { status: 200 }));
		vi.stubGlobal('fetch', fn);

		const result = await fetchSnapshot(env, { owner: 'octocat', repo: 'hello' }, 'abc123');
		expect(result).toEqual({ success: true, data: [{ path: 'SKILL.md', content: '# Demo' }] });
		expect(fn.mock.calls[0][0]).toBe('https://codeload.github.com/octocat/hello/tar.gz/abc123');
	});

	it('maps a 404 to not-found', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
		const result = await fetchSnapshot(env, { owner: 'octocat', repo: 'hello' }, 'abc123');
		expect(result).toMatchObject({ success: false, code: 'not-found' });
	});

	it('maps a network failure to upstream', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')));
		const result = await fetchSnapshot(env, { owner: 'octocat', repo: 'hello' }, 'abc123');
		expect(result).toMatchObject({ success: false, code: 'upstream' });
	});
});
