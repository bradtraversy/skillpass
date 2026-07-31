import { unzipSync, type UnzipFileInfo } from 'fflate';
import { byPath, type PackageFile } from 'validator';
import { sourceError, type SourceResult } from '../github/errors';
import { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from '../github/snapshot';

// Thrown from the fflate filter to abort extraction with a typed result.
class ZipReject extends Error {
	constructor(readonly result: SourceResult<never>) {
		super('zip rejected');
	}
}

function checkEntryName(name: string): void {
	if (name.includes('\\') || name.startsWith('/')) {
		throw new ZipReject(sourceError('bad-archive', `zip entry has an unsafe path: "${name}"`));
	}
	const segments = name.split('/');
	// A trailing "" segment is a directory marker; anything else empty is malformed.
	if (segments.slice(0, -1).some((s) => s === '') || segments.some((s) => s === '.' || s === '..')) {
		throw new ZipReject(sourceError('bad-archive', `zip entry has an unsafe path: "${name}"`));
	}
}

function stripSharedRoot(paths: string[]): (path: string) => string {
	const roots = new Set(paths.map((p) => p.split('/')[0]));
	const allNested = paths.every((p) => p.includes('/'));
	if (paths.length > 0 && allNested && roots.size === 1) {
		const rootLength = [...roots][0].length + 1;
		return (path) => path.slice(rootLength);
	}
	return (path) => path;
}

// Same caps and posture as the tarball path; the fflate filter sees each
// entry's declared sizes before decompression, so a zip bomb is rejected from
// its headers. Actual byte lengths are re-checked after - headers can lie.
export function extractZip(bytes: Uint8Array): SourceResult<PackageFile[]> {
	let entries: Record<string, Uint8Array>;
	let fileCount = 0;
	let declaredTotal = 0;

	const filter = (info: UnzipFileInfo): boolean => {
		if (info.name.endsWith('/')) {
			return false;
		}
		checkEntryName(info.name);
		fileCount += 1;
		if (fileCount > MAX_FILES) {
			throw new ZipReject(sourceError('too-large', `package exceeds ${MAX_FILES} files`));
		}
		if (info.originalSize > MAX_FILE_BYTES) {
			throw new ZipReject(
				sourceError('too-large', `"${info.name}" exceeds ${MAX_FILE_BYTES / 1024 / 1024} MB`),
			);
		}
		declaredTotal += info.originalSize;
		if (declaredTotal > MAX_TOTAL_BYTES) {
			throw new ZipReject(
				sourceError('too-large', `package exceeds ${MAX_TOTAL_BYTES / 1024 / 1024} MB total`),
			);
		}
		return true;
	};

	try {
		entries = unzipSync(bytes, { filter });
	} catch (err) {
		if (err instanceof ZipReject) {
			return err.result;
		}
		return sourceError('bad-archive', `could not read the zip: ${(err as Error).message}`);
	}

	const names = Object.keys(entries);
	if (names.length === 0) {
		return sourceError(
			'empty-package',
			'the zip contains no files - zip the skill folder so SKILL.md sits at the top level',
		);
	}

	let actualTotal = 0;
	const strip = stripSharedRoot(names);
	const files: PackageFile[] = [];
	for (const name of names) {
		const data = entries[name];
		actualTotal += data.length;
		if (data.length > MAX_FILE_BYTES || actualTotal > MAX_TOTAL_BYTES) {
			return sourceError('too-large', 'zip contents exceed the declared sizes');
		}
		files.push({ path: strip(name), content: Buffer.from(data).toString('utf8') });
	}

	return { success: true, data: files.sort(byPath) };
}
