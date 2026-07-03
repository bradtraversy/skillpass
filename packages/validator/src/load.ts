import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseManifest, type Manifest } from 'skill-schema';

export interface PackageFile {
	path: string; // relative to the package dir, posix separators
	content: string;
}

export type ManifestState =
	| { state: 'ok'; data: Manifest; raw: string }
	| { state: 'missing' }
	| { state: 'invalid'; error: string };

export interface SkillEntryFile {
	skillName: string;
	path: string;
	exists: boolean;
}

export interface LoadedPackage {
	dir: string;
	files: PackageFile[];
	manifest: ManifestState;
	entries: SkillEntryFile[];
	sourceHash: string;
}

export class PackageReadError extends Error {
	constructor(dir: string, cause: unknown) {
		super(`cannot read skill package at "${dir}"`, { cause });
		this.name = 'PackageReadError';
	}
}

const SKIP_DIRS = new Set(['.git', 'node_modules']);

function walk(root: string, rel = ''): PackageFile[] {
	const files: PackageFile[] = [];
	for (const name of readdirSync(join(root, rel)).sort()) {
		const relPath = rel === '' ? name : `${rel}/${name}`;
		const stats = statSync(join(root, relPath));
		if (stats.isDirectory()) {
			if (!SKIP_DIRS.has(name)) {
				files.push(...walk(root, relPath));
			}
		} else {
			files.push({ path: relPath, content: readFileSync(join(root, relPath), 'utf8') });
		}
	}
	return files;
}

function hashFiles(files: PackageFile[]): string {
	const hash = createHash('sha256');
	for (const file of files) {
		hash.update(file.path);
		hash.update('\0');
		hash.update(file.content);
		hash.update('\0');
	}
	return `sha256:${hash.digest('hex')}`;
}

function readManifest(files: PackageFile[]): ManifestState {
	const file = files.find((f) => f.path === 'skill.json');
	if (!file) {
		return { state: 'missing' };
	}
	let json: unknown;
	try {
		json = JSON.parse(file.content);
	} catch (err) {
		return { state: 'invalid', error: `skill.json is not valid JSON: ${(err as Error).message}` };
	}
	const result = parseManifest(json);
	if (!result.success) {
		return { state: 'invalid', error: result.error };
	}
	return { state: 'ok', data: result.data, raw: file.content };
}

function resolveEntries(dir: string, manifest: ManifestState, files: PackageFile[]): SkillEntryFile[] {
	const has = (path: string) => files.some((f) => f.path === path);

	if (manifest.state === 'invalid') {
		return []; // unresolvable; the invalid-manifest finding already fails the scan
	}
	if (manifest.state === 'missing') {
		return [{ skillName: basename(dir), path: 'SKILL.md', exists: has('SKILL.md') }];
	}

	const { data } = manifest;
	if (!data.skills) {
		return [{ skillName: data.name, path: 'SKILL.md', exists: has('SKILL.md') }];
	}
	return data.skills.flatMap((skill) => [
		{ skillName: skill.name, path: skill.entry, exists: has(skill.entry) },
		...Object.values(skill.variants ?? {}).map((path) => ({
			skillName: skill.name,
			path,
			exists: has(path),
		})),
	]);
}

export function loadPackage(dir: string): LoadedPackage {
	let files: PackageFile[];
	try {
		files = walk(dir);
	} catch (err) {
		throw new PackageReadError(dir, err);
	}
	const manifest = readManifest(files);
	return {
		dir,
		files,
		manifest,
		entries: resolveEntries(dir, manifest, files),
		sourceHash: hashFiles(files),
	};
}
