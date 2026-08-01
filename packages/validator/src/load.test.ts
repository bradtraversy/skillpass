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

	const skillMd = (name: string, description = `Does ${name} things.`) =>
		`---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;

	it('infers a pack from paired adapter dirs with codex variants', () => {
		const pkg = loadPackageFromFiles(
			[
				{ path: '.claude/skills/plan/SKILL.md', content: skillMd('plan') },
				{ path: '.agents/skills/plan/SKILL.md', content: skillMd('plan') },
				{ path: '.claude/skills/apply/SKILL.md', content: skillMd('apply') },
				{ path: '.agents/skills/apply/SKILL.md', content: skillMd('apply') },
				{ path: 'README.md', content: '# My Pack\n\nA workflow in two acts.\n' },
			],
			'my-pack',
		);
		expect(pkg.manifest.state).toBe('ok');
		if (pkg.manifest.state !== 'ok') return;
		expect(pkg.manifest.inferred).toBe(true);
		expect(pkg.manifest.data.name).toBe('my-pack');
		expect(pkg.manifest.data.description).toBe('A workflow in two acts.');
		expect(pkg.manifest.data.targets.sort()).toEqual(['claude-code', 'codex']);
		expect(pkg.manifest.data.skills).toEqual([
			{
				name: 'apply',
				description: 'Does apply things.',
				entry: '.claude/skills/apply/SKILL.md',
				targets: ['claude-code', 'codex'],
				variants: { codex: '.agents/skills/apply/SKILL.md' },
			},
			{
				name: 'plan',
				description: 'Does plan things.',
				entry: '.claude/skills/plan/SKILL.md',
				targets: ['claude-code', 'codex'],
				variants: { codex: '.agents/skills/plan/SKILL.md' },
			},
		]);
		expect(pkg.entries.every((e) => e.exists)).toBe(true);
	});

	it('gives an unpaired adapter folder its single target and no variant', () => {
		const pkg = loadPackageFromFiles(
			[
				{ path: '.claude/skills/plan/SKILL.md', content: skillMd('plan') },
				{ path: '.agents/skills/plan/SKILL.md', content: skillMd('plan') },
				{ path: '.agents/skills/solo/SKILL.md', content: skillMd('solo') },
			],
			'my-pack',
		);
		if (pkg.manifest.state !== 'ok') throw new Error('expected ok');
		const solo = pkg.manifest.data.skills?.find((s) => s.name === 'solo');
		expect(solo).toEqual({
			name: 'solo',
			description: 'Does solo things.',
			entry: '.agents/skills/solo/SKILL.md',
			targets: ['codex'],
		});
	});

	it('infers a pack from a plain skills/ dir with default targets', () => {
		const pkg = loadPackageFromFiles(
			[
				{ path: 'skills/one/SKILL.md', content: skillMd('one') },
				{ path: 'skills/two/SKILL.md', content: skillMd('two') },
			],
			'plain-pack',
		);
		if (pkg.manifest.state !== 'ok') throw new Error('expected ok');
		expect(pkg.manifest.data.description).toBe('A pack of 2 skills');
		expect(pkg.manifest.data.skills?.map((s) => s.entry)).toEqual([
			'skills/one/SKILL.md',
			'skills/two/SKILL.md',
		]);
		expect(pkg.manifest.data.skills?.every((s) => !s.variants)).toBe(true);
	});

	it('skips README HTML and badge lines when inferring the pack description', () => {
		const readme = '<p align="center">\n<img src="logo.png" />\n</p>\n\n# Pack\n\n[![CI](x)](y)\n\nThe real first prose line.\n';
		const pkg = loadPackageFromFiles(
			[
				{ path: 'skills/one/SKILL.md', content: skillMd('one') },
				{ path: 'skills/two/SKILL.md', content: skillMd('two') },
				{ path: 'README.md', content: readme },
			],
			'pack',
		);
		if (pkg.manifest.state !== 'ok') throw new Error('expected ok');
		expect(pkg.manifest.data.description).toBe('The real first prose line.');
	});

	it('lets a root SKILL.md win over nested layouts', () => {
		const pkg = loadPackageFromFiles(
			[
				{ path: 'SKILL.md', content: skillMd('root-skill') },
				{ path: '.claude/skills/nested/SKILL.md', content: skillMd('nested') },
			],
			'repo',
		);
		if (pkg.manifest.state !== 'ok') throw new Error('expected ok');
		expect(pkg.manifest.data.name).toBe('root-skill');
		expect(pkg.manifest.data.skills).toBeUndefined();
	});

	it('anchors a single nested skill on its own file, not the repo name', () => {
		const pkg = loadPackageFromFiles(
			[{ path: '.claude/skills/lonely/SKILL.md', content: skillMd('lonely') }],
			'some-repo',
		);
		if (pkg.manifest.state !== 'ok') throw new Error('expected ok');
		expect(pkg.manifest.data.name).toBe('lonely');
		expect(pkg.manifest.data.description).toBe('Does lonely things.');
		expect(pkg.manifest.data.skills).toHaveLength(1);
		expect(pkg.entries).toEqual([
			{ skillName: 'lonely', path: '.claude/skills/lonely/SKILL.md', exists: true },
		]);
	});

	it('falls back to folder names when frontmatter names collide', () => {
		const pkg = loadPackageFromFiles(
			[
				{ path: 'skills/alpha/SKILL.md', content: skillMd('helper') },
				{ path: 'skills/beta/SKILL.md', content: skillMd('helper') },
			],
			'pack',
		);
		if (pkg.manifest.state !== 'ok') throw new Error('expected ok');
		expect(pkg.manifest.data.skills?.map((s) => s.name)).toEqual(['helper', 'beta']);
	});

	it('never infers a pack when an explicit skill.json exists', () => {
		const manifest = {
			schemaVersion: '0.1',
			name: 'explicit',
			description: 'Explicit wins',
			targets: ['claude-code'],
			permissions: [],
		};
		const pkg = loadPackageFromFiles(
			[
				{ path: 'skill.json', content: JSON.stringify(manifest) },
				{ path: '.claude/skills/other/SKILL.md', content: skillMd('other') },
			],
			'repo',
		);
		if (pkg.manifest.state !== 'ok') throw new Error('expected ok');
		expect(pkg.manifest.inferred).toBeUndefined();
		expect(pkg.manifest.data.name).toBe('explicit');
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
