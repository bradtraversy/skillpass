import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseManifest, type Manifest, type SkillEntry, type Target } from 'skill-schema';
import { detectPermissions } from './rules/permissions';

export interface PackageFile {
	path: string; // relative to the package dir, posix separators
	content: string;
}

export type ManifestState =
	| { state: 'ok'; data: Manifest; inferred?: boolean }
	| { state: 'missing' }
	| { state: 'invalid'; error: string };

export interface SkillEntryFile {
	skillName: string;
	path: string;
	exists: boolean;
}

export interface LoadedPackage {
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
	return { state: 'ok', data: result.data };
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

// name/description only; deliberately not a full YAML parser. Reads SKILL.md
// frontmatter (including `>`/`|` block scalars, common for descriptions), then
// falls back to the first prose paragraph for a description.
function readSkillMeta(content: string): { name?: string; description?: string } {
	const out: { name?: string; description?: string } = {};
	const fm = FRONTMATTER_RE.exec(content);
	const body = fm ? content.slice(fm[0].length) : content;
	if (fm) {
		const lines = fm[1].split('\n');
		for (let i = 0; i < lines.length; i++) {
			const kv = /^(name|description):\s*(.*?)\s*$/.exec(lines[i]);
			if (!kv) continue;
			const key = kv[1] as 'name' | 'description';
			if (out[key]) continue;
			const block = /^([|>])[+-]?$/.exec(kv[2]);
			if (block) {
				// YAML block scalar: gather the following more-indented lines. Folded
				// (`>`) joins with spaces, literal (`|`) keeps newlines.
				const gathered: string[] = [];
				for (let j = i + 1; j < lines.length; j++) {
					if (lines[j].trim() === '') gathered.push('');
					else if (/^\s/.test(lines[j])) gathered.push(lines[j].trim());
					else break;
				}
				const text =
					block[1] === '>'
						? gathered.join(' ').replace(/\s+/g, ' ').trim()
						: gathered.join('\n').trim();
				if (text) out[key] = text;
			} else {
				// A plain scalar may continue on indented lines; YAML folds them with spaces.
				const parts = [kv[2]];
				for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) parts.push(lines[j].trim());
				out[key] = parts.join(' ').replace(/^["']|["']$/g, '');
			}
		}
	}
	if (!out.description) {
		const prose = firstParagraph(body);
		if (prose) out.description = prose;
	}
	return out;
}

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
const MD_LINK_RE = /\[([^\]]*)\]\([^)]*\)/g;
const STRUCTURAL_LINE_RE = /^(#|!\[|\[!\[|---$|\*\*\*$|___$)|^<h[1-6][\s>]/i;
const DESCRIPTION_MAX = 200;

const cleanInline = (line: string): string =>
	line
		.replace(HTML_TAG_RE, ' ')
		.replace(MD_LINK_RE, '$1')
		.replace(/^>\s?/, '')
		.replace(/\s+/g, ' ')
		.trim();

// Prefer ending on a sentence; otherwise cut on a word and drop a dangling
// comma so the result never reads as a wrap-truncated fragment.
function clip(text: string, max: number): string {
	if (text.length <= max) return text;
	const head = text.slice(0, max);
	const sentenceEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
	if (sentenceEnd >= 60) return head.slice(0, sentenceEnd + 1);
	const wordEnd = head.lastIndexOf(' ');
	return (wordEnd > 0 ? head.slice(0, wordEnd) : head).replace(/[,;:]+$/, '').trim();
}

// First paragraph of prose in a markdown body. Headings (markdown or <h1>),
// images, badges, rules, and lines that are only markup (logo blocks) are
// dropped; inline tags and link syntax are stripped so a README whose tagline
// is `<p align="center"><strong>...</strong></p>` still yields the tagline.
function firstParagraph(text: string): string | undefined {
	const kept: string[] = [];
	for (const raw of text.split('\n')) {
		const source = raw.trim();
		const line = STRUCTURAL_LINE_RE.test(source) ? '' : cleanInline(source);
		if (!line) {
			if (kept.length > 0) break;
			continue;
		}
		kept.push(line);
	}
	return kept.length > 0 ? clip(kept.join(' '), DESCRIPTION_MAX) : undefined;
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
	const permissions = detectPermissions(files);
	return {
		schemaVersion: '0.1',
		name,
		description: meta.description ?? name,
		targets: inferTargets(files),
		permissions,
		distribution: 'skill',
	};
}

const CLAUDE_SKILL_RE = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/;
const AGENTS_SKILL_RE = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/;
const PLAIN_SKILL_RE = /^skills\/([^/]+)\/SKILL\.md$/;

interface MemberFiles {
	folder: string;
	claudePath?: string;
	agentsPath?: string;
	plainPath?: string;
}

// Adapter dirs win over a plain skills/ dir so a repo carrying both (adapters
// plus a build output or vendored copy) doesn't double-count members.
function collectMemberFiles(files: PackageFile[]): MemberFiles[] {
	const byFolder = new Map<string, MemberFiles>();
	const add = (folder: string, key: 'claudePath' | 'agentsPath' | 'plainPath', path: string) => {
		const member = byFolder.get(folder) ?? { folder };
		member[key] = path;
		byFolder.set(folder, member);
	};
	for (const file of files) {
		const claude = CLAUDE_SKILL_RE.exec(file.path);
		if (claude) add(claude[1], 'claudePath', file.path);
		const agents = AGENTS_SKILL_RE.exec(file.path);
		if (agents) add(agents[1], 'agentsPath', file.path);
	}
	if (byFolder.size > 0) return [...byFolder.values()];
	for (const file of files) {
		const plain = PLAIN_SKILL_RE.exec(file.path);
		if (plain) add(plain[1], 'plainPath', file.path);
	}
	return [...byFolder.values()];
}

function readmeProse(files: PackageFile[]): string | undefined {
	const readme = files.find((f) => f.path === 'README.md');
	return readme ? firstParagraph(readme.content) : undefined;
}

// Synthesize a manifest for a repo whose skills live in nested layouts
// (.claude/skills + .agents/skills, or skills/) with no root SKILL.md or
// skill.json. Same-named adapter folders pair into one entry with a codex
// variant. Returns null when no recognized layout matches.
function inferNestedManifest(files: PackageFile[], fallbackName: string): Manifest | null {
	const members = collectMemberFiles(files).sort((a, b) =>
		a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0,
	);
	if (members.length === 0) {
		return null;
	}

	const used = new Set<string>();
	const packTargets = new Set<Target>();
	const entries: SkillEntry[] = members.map((member) => {
		const entryPath = member.claudePath ?? member.agentsPath ?? (member.plainPath as string);
		const file = files.find((f) => f.path === entryPath) as PackageFile;
		const meta = readSkillMeta(file.content);
		// Frontmatter names can collide across folders; folder names can't
		// within a layout, so a duplicate falls back to its folder name.
		let entryName = slugify(meta.name ?? member.folder);
		if (used.has(entryName)) entryName = slugify(member.folder);
		used.add(entryName);
		const targets: Target[] = member.plainPath
			? inferTargets(files)
			: [
					...(member.claudePath ? (['claude-code'] as const) : []),
					...(member.agentsPath ? (['codex'] as const) : []),
				];
		for (const target of targets) packTargets.add(target);
		return {
			name: entryName,
			...(meta.description ? { description: meta.description } : {}),
			entry: entryPath,
			targets,
			...(member.claudePath && member.agentsPath
				? { variants: { codex: member.agentsPath } }
				: {}),
		};
	});

	const single = entries.length === 1 ? entries[0] : null;
	const permissions = detectPermissions(files);
	return {
		schemaVersion: '0.1',
		name: single ? single.name : slugify(fallbackName),
		description: single
			? (single.description ?? single.name)
			: (readmeProse(files) ?? `A pack of ${entries.length} skills`),
		targets: [...packTargets],
		permissions,
		distribution: 'skill',
		skills: entries,
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
	// A root SKILL.md always wins as a single skill; otherwise nested layouts
	// infer a (possibly multi-skill) manifest. A package with none of these
	// stays 'missing' and fails on missing-skill-file.
	if (manifest.state === 'missing') {
		const data = sorted.some((f) => f.path === 'SKILL.md')
			? inferManifest(sorted, name)
			: inferNestedManifest(sorted, name);
		if (data) {
			manifest = { state: 'ok', inferred: true, data };
		}
	}
	return {
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
