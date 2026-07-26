import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPackage, loadPackageFromFiles, PackageReadError } from './load';

const fixture = (name: string) => join(import.meta.dirname, '..', 'fixtures', name);

describe('loadPackage on clean-skill', () => {
	const pkg = loadPackage(fixture('clean-skill'));

	it('reads the files with sorted relative paths', () => {
		expect(pkg.files.map((f) => f.path)).toEqual(['SKILL.md', 'skill.json']);
	});

	it('parses the manifest', () => {
		expect(pkg.manifest.state).toBe('ok');
		if (pkg.manifest.state === 'ok') {
			expect(pkg.manifest.data.name).toBe('clean-skill');
		}
	});

	it('resolves the single root entry', () => {
		expect(pkg.entries).toEqual([{ skillName: 'clean-skill', path: 'SKILL.md', exists: true }]);
	});

	it('computes a sha256 source hash', () => {
		expect(pkg.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
	});
});

describe('loadPackage on workflow-pack', () => {
	const pkg = loadPackage(fixture('workflow-pack'));

	it('resolves entries and variants for both skills', () => {
		expect(pkg.entries).toEqual([
			{ skillName: 'plan', path: 'skills/plan/SKILL.md', exists: true },
			{ skillName: 'plan', path: '.claude/skills/plan/SKILL.md', exists: true },
			{ skillName: 'apply', path: 'skills/apply/SKILL.md', exists: true },
		]);
	});

	it('walks nested and dot directories', () => {
		expect(pkg.files.map((f) => f.path)).toContain('.claude/skills/plan/SKILL.md');
	});
});

describe('source hash', () => {
	let dir: string;

	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it('is stable across loads and changes when content changes', () => {
		dir = mkdtempSync(join(tmpdir(), 'validator-test-'));
		writeFileSync(join(dir, 'SKILL.md'), '# temp skill\n');
		const first = loadPackage(dir).sourceHash;
		const second = loadPackage(dir).sourceHash;
		expect(second).toBe(first);

		writeFileSync(join(dir, 'SKILL.md'), '# temp skill, edited\n');
		expect(loadPackage(dir).sourceHash).not.toBe(first);
	});
});

describe('loadPackageFromFiles', () => {
	it('matches the fs load exactly, regardless of input order', () => {
		const fromDisk = loadPackage(fixture('workflow-pack'));
		const reversed = [...fromDisk.files].reverse();
		const fromMemory = loadPackageFromFiles(reversed, fixture('workflow-pack'));

		expect(fromMemory.sourceHash).toBe(fromDisk.sourceHash);
		expect(fromMemory.files).toEqual(fromDisk.files);
		expect(fromMemory.entries).toEqual(fromDisk.entries);
	});

	it('infers a manifest from the given name for a manifest-less package', () => {
		const pkg = loadPackageFromFiles([{ path: 'SKILL.md', content: '# hi\n' }], 'my-skill');
		expect(pkg.manifest.state).toBe('ok');
		if (pkg.manifest.state === 'ok') {
			expect(pkg.manifest.inferred).toBe(true);
			expect(pkg.manifest.data.name).toBe('my-skill');
			expect(pkg.manifest.data.distribution).toBe('skill');
			expect(pkg.manifest.data.targets).toEqual(['claude-code', 'codex']);
		}
		expect(pkg.entries).toEqual([{ skillName: 'my-skill', path: 'SKILL.md', exists: true }]);
	});

	it('stays missing when there is no SKILL.md to infer from', () => {
		const pkg = loadPackageFromFiles([{ path: 'README.md', content: '# hi\n' }], 'my-skill');
		expect(pkg.manifest.state).toBe('missing');
	});
});

describe('frontmatter description parsing', () => {
	const describeFor = (content: string) => {
		const pkg = loadPackageFromFiles([{ path: 'SKILL.md', content }], 'fallback-name');
		return pkg.manifest.state === 'ok' ? pkg.manifest.data.description : undefined;
	};

	it.each([
		['a plain value', 'name: x\ndescription: A plain one-line description.\n', 'A plain one-line description.'],
		['a quoted value', 'name: x\ndescription: "A quoted description."\n', 'A quoted description.'],
		[
			'a folded (>-) block scalar',
			'name: x\ndescription: >-\n  First line of the folded\n  description continues here.\n',
			'First line of the folded description continues here.',
		],
		[
			'a folded (>) block scalar',
			'name: x\ndescription: >\n  Wycheproof provides test vectors.\n  Use when testing crypto code.\n',
			'Wycheproof provides test vectors. Use when testing crypto code.',
		],
		[
			'a literal (|) block scalar',
			'name: x\ndescription: |\n  Line one.\n  Line two.\n',
			'Line one.\nLine two.',
		],
	])('reads %s', (_label, content, expected) => {
		expect(describeFor(`---\n${content}---\n\n# Heading\n`)).toBe(expected);
	});

	it('does not leak a later key into a folded description block', () => {
		const content =
			'---\nname: x\ndescription: >-\n  Folded description body.\nallowed-tools: Read Grep\n---\n\n# Heading\n';
		expect(describeFor(content)).toBe('Folded description body.');
	});
});

describe('loadPackage errors', () => {
	it('throws a typed error for a nonexistent directory', () => {
		expect(() => loadPackage('/nonexistent/skill-package')).toThrow(PackageReadError);
	});
});
