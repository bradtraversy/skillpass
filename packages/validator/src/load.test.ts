import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPackage, PackageReadError } from './load';

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

describe('loadPackage errors', () => {
	it('throws a typed error for a nonexistent directory', () => {
		expect(() => loadPackage('/nonexistent/skill-package')).toThrow(PackageReadError);
	});
});
