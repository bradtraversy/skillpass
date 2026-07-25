import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseManifest, type Manifest, type Target } from 'skill-schema';
import { detectPermissions } from './rules/permissions';

export interface PackageFile {
	path: string; // relative to the package dir, posix separators
	content: string;
}

export type ManifestState =
	| { state: 'ok'; data: Manifest; raw: string; inferred?: boolean }
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

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

// name/description only; deliberately not a full YAML parser. Reads SKILL.md
// frontmatter, then falls back to the first prose line for a description.
function readSkillMeta(content: string): { name?: string; description?: string } {
	const out: { name?: string; description?: string } = {};
	const fm = FRONTMATTER_RE.exec(content);
	const body = fm ? content.slice(fm[0].length) : content;
	if (fm) {
		for (const line of fm[1].split('\n')) {
			const kv = /^(name|description):\s*(.+?)\s*$/.exec(line);
			if (!kv) continue;
			const value = kv[2].replace(/^["']|["']$/g, '');
			if (kv[1] === 'name' && !out.name) out.name = value;
			if (kv[1] === 'description' && !out.description) out.description = value;
		}
	}
	if (!out.description) {
		const prose = body
			.split('\n')
			.map((line) => line.trim())
			.find((line) => line && !line.startsWith('#'));
		if (prose) out.description = prose.slice(0, 200);
	}
	return out;
}

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'skill';
}

function inferTargets(files: PackageFile[]): Target[] {
	const targets = new Set<Target>();
	for (const file of files) {
		if (file.path.includes('.claude/skills')) targets.add('claude-code');
		if (file.path.includes('.agents/skills')) targets.add('codex');
	}
	return targets.size > 0 ? [...targets] : ['claude-code', 'codex'];
}

// Synthesize a manifest for a bare SKILL.md so it lists without an author-written
// skill.json. Detected permissions are declared as-is and shown informationally on
// the passport; flagging harmful intent is the content rule's job, not this list's.
function inferManifest(files: PackageFile[], fallbackName: string): Manifest {
	const skillFile = files.find((f) => f.path === 'SKILL.md');
	const meta = skillFile ? readSkillMeta(skillFile.content) : {};
	const name = slugify(meta.name ?? fallbackName);
	const permissions = [...new Set(detectPermissions(files).map((d) => d.permission))];
	return {
		schemaVersion: '0.1',
		name,
		description: meta.description ?? name,
		targets: inferTargets(files),
		permissions,
		distribution: 'skill',
	};
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

export const byPath = (a: PackageFile, b: PackageFile) =>
	a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

// Canonical load path for both fs and in-memory sources (API snapshots, feature 6's
// worker); the flat path sort here defines the file order the source hash is built on.
export function loadPackageFromFiles(files: PackageFile[], name = 'package'): LoadedPackage {
	const sorted = [...files].sort(byPath);
	let manifest = readManifest(sorted);
	// No skill.json but a SKILL.md is present: infer a manifest so the skill lists.
	// A package with neither stays 'missing' and fails on missing-skill-file.
	if (manifest.state === 'missing' && sorted.some((f) => f.path === 'SKILL.md')) {
		const data = inferManifest(sorted, name);
		manifest = { state: 'ok', inferred: true, data, raw: JSON.stringify(data, null, 2) };
	}
	return {
		dir: name,
		files: sorted,
		manifest,
		entries: resolveEntries(name, manifest, sorted),
		sourceHash: hashFiles(sorted),
	};
}

export function loadPackage(dir: string): LoadedPackage {
	let files: PackageFile[];
	try {
		files = walk(dir);
	} catch (err) {
		throw new PackageReadError(dir, err);
	}
	return loadPackageFromFiles(files, dir);
}
