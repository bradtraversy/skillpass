import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar-stream';
import { byPath, isBinary, type PackageFile } from 'validator';
import type { Env } from '../env';
import { sourceError, type SourceResult } from './errors';
import { GITHUB_TIMEOUT_MS, githubHeaders } from './pin';
import type { RepoTarget } from './url';

export const MAX_FILES = 500;
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
// Abuse ceiling on everything streamed, kept or skipped - a monorepo subpath
// submission legitimately skips far more than the 10 MB kept-files cap allows.
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

export async function fetchSnapshot(
	env: Env,
	target: RepoTarget,
	sha: string,
): Promise<SourceResult<PackageFile[]>> {
	const url = `https://codeload.github.com/${target.owner}/${target.repo}/tar.gz/${encodeURIComponent(sha)}`;

	let res: Response;
	try {
		res = await fetch(url, {
			headers: githubHeaders(env),
			signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
		});
	} catch (err) {
		return sourceError('upstream', `github archive download errored: ${(err as Error).message}`);
	}

	if (res.status === 404) {
		return sourceError('not-found', 'no archive for the pinned commit');
	}
	if (!res.ok || !res.body) {
		return sourceError('upstream', `github archive download failed (${res.status})`);
	}
	return extractTarball(res.body, target.subpath);
}

// Streams the tarball through gunzip + tar, enforcing the caps as bytes arrive so
// an oversized archive is rejected without ever being buffered whole.
export async function extractTarball(
	body: ReadableStream<Uint8Array>,
	subpath?: string,
	maxDownloadBytes = MAX_DOWNLOAD_BYTES,
): Promise<SourceResult<PackageFile[]>> {
	// Bridges the DOM-vs-node web-stream generic mismatch; same runtime object.
	const source = Readable.fromWeb(body as NodeReadableStream<Uint8Array>);
	const untar = extract();
	let pumpError: Error | undefined;
	const pump = pipeline(source, createGunzip(), untar).catch((err: Error) => {
		pumpError = err;
	});

	const files: PackageFile[] = [];
	let totalBytes = 0;
	let downloadBytes = 0;

	try {
		for await (const entry of untar) {
			const segments = entry.header.name.split('/').filter((s) => s !== '');
			if (segments.some((s) => s === '..')) {
				return sourceError('bad-archive', 'archive contains a path-traversal entry');
			}

			// GitHub tarballs nest everything under "{repo}-{sha}/"; strip that root.
			const rel = segments.slice(1).join('/');
			const path =
				subpath === undefined
					? rel
					: rel.startsWith(`${subpath}/`)
						? rel.slice(subpath.length + 1)
						: '';
			const keep = entry.header.type === 'file' && path !== '';
			if (keep && files.length >= MAX_FILES) {
				return sourceError('too-large', `package exceeds ${MAX_FILES} files`);
			}

			const chunks: Buffer[] = [];
			let bytes = 0;
			for await (const chunk of entry as AsyncIterable<Buffer>) {
				downloadBytes += chunk.length;
				if (downloadBytes > maxDownloadBytes) {
					return sourceError(
						'too-large',
						`archive exceeds the ${Math.round(maxDownloadBytes / 1024 / 1024)} MB download budget`,
					);
				}
				if (!keep) {
					continue;
				}
				bytes += chunk.length;
				totalBytes += chunk.length;
				if (bytes > MAX_FILE_BYTES) {
					return sourceError('too-large', `"${path}" exceeds ${MAX_FILE_BYTES / 1024 / 1024} MB`);
				}
				if (totalBytes > MAX_TOTAL_BYTES) {
					return sourceError(
						'too-large',
						`package exceeds ${MAX_TOTAL_BYTES / 1024 / 1024} MB total`,
					);
				}
				chunks.push(chunk);
			}
			if (keep) {
				const bytes = Buffer.concat(chunks);
				// Snapshots hold text; a decoded binary would be written back corrupt.
				if (isBinary(bytes)) console.warn(`snapshot: dropping binary file ${path}`);
				else files.push({ path, content: bytes.toString('utf8') });
			}
		}
		await pump;
	} catch (err) {
		pumpError ??= err as Error;
	} finally {
		source.destroy();
	}

	if (pumpError) {
		return sourceError('bad-archive', `could not read the repository archive: ${pumpError.message}`);
	}
	if (files.length === 0) {
		return sourceError(
			'empty-package',
			subpath === undefined
				? 'the repository has no files at the pinned commit'
				: `no files under "${subpath}" at the pinned commit - point the /tree/ URL at the folder that contains SKILL.md`,
		);
	}
	return { success: true, data: files.sort(byPath) };
}
