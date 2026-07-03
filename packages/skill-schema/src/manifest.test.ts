import { describe, expect, it } from 'vitest';
import { parseManifest, type Manifest } from './manifest';

function singleSkill(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		schemaVersion: '0.1',
		name: 'commit-message-writer',
		description: 'Writes conventional commit messages from the staged diff.',
		version: '1.2.0',
		targets: ['claude-code', 'codex'],
		permissions: ['filesystem.read.project', 'shell.suggest'],
		...overrides,
	};
}

function pack(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return singleSkill({
		name: 'ai-blueprint',
		description: 'The AI Coding Blueprint workflow skills.',
		targets: ['claude-code', 'codex'],
		permissions: ['filesystem.read.project', 'filesystem.write.project'],
		skills: [
			{
				name: 'feature',
				entry: 'skills/feature/SKILL.md',
				variants: {
					'claude-code': '.claude/skills/feature/SKILL.md',
					codex: '.agents/skills/feature/SKILL.md',
				},
			},
			{
				name: 'implement',
				entry: 'skills/implement/SKILL.md',
				targets: ['claude-code'],
				permissions: ['filesystem.write.project'],
			},
		],
		...overrides,
	});
}

describe('parseManifest accepts', () => {
	it('a valid single-skill manifest', () => {
		const result = parseManifest(singleSkill());
		expect(result.success).toBe(true);
		if (result.success) {
			const manifest: Manifest = result.data;
			expect(manifest.skills).toBeUndefined();
			expect(manifest.targets).toEqual(['claude-code', 'codex']);
		}
	});

	it('a two-skill pack with variants', () => {
		const result = parseManifest(pack());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.skills).toHaveLength(2);
		}
	});

	it('an empty permissions array (docs-only skill)', () => {
		expect(parseManifest(singleSkill({ permissions: [] })).success).toBe(true);
	});

	it('a manifest without a version', () => {
		const { version: _version, ...rest } = singleSkill();
		expect(parseManifest(rest).success).toBe(true);
	});
});

describe('parseManifest rejects', () => {
	it('a missing name', () => {
		const { name: _name, ...rest } = singleSkill();
		expect(parseManifest(rest).success).toBe(false);
	});

	it('a non-slug name', () => {
		expect(parseManifest(singleSkill({ name: 'My Skill' })).success).toBe(false);
	});

	it('a bad semver version', () => {
		expect(parseManifest(singleSkill({ version: 'v1.2' })).success).toBe(false);
	});

	it('an unknown target', () => {
		expect(parseManifest(singleSkill({ targets: ['claude-code', 'vscode'] })).success).toBe(false);
	});

	it('empty targets', () => {
		expect(parseManifest(singleSkill({ targets: [] })).success).toBe(false);
	});

	it('an unknown permission key', () => {
		expect(parseManifest(singleSkill({ permissions: ['filesystem.format.disk'] })).success).toBe(
			false,
		);
	});

	it('an empty skills array', () => {
		expect(parseManifest(pack({ skills: [] })).success).toBe(false);
	});

	it('duplicate skill entry names', () => {
		const duplicated = pack();
		const skills = duplicated.skills as { name: string }[];
		skills[1].name = skills[0].name;
		const result = parseManifest(duplicated);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain('duplicate skill entry name');
		}
	});

	it('entry targets that are not a subset of the package targets', () => {
		const invalid = pack();
		(invalid.skills as { targets?: string[] }[])[1].targets = ['cursor'];
		const result = parseManifest(invalid);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain('not declared by the package');
		}
	});

	it('entry permissions that are not a subset of the package permissions', () => {
		const invalid = pack();
		(invalid.skills as { permissions?: string[] }[])[1].permissions = ['shell.execute'];
		expect(parseManifest(invalid).success).toBe(false);
	});

	it('a variant for a target the skill does not support', () => {
		const invalid = pack();
		(invalid.skills as { targets?: string[]; variants?: Record<string, string> }[])[1].variants = {
			codex: '.agents/skills/implement/SKILL.md',
		};
		const result = parseManifest(invalid);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain('variant target');
		}
	});

	it('path traversal in an entry path', () => {
		const invalid = pack();
		(invalid.skills as { entry: string }[])[0].entry = '../outside/SKILL.md';
		expect(parseManifest(invalid).success).toBe(false);
	});

	it('an absolute entry path', () => {
		const invalid = pack();
		(invalid.skills as { entry: string }[])[0].entry = '/etc/SKILL.md';
		expect(parseManifest(invalid).success).toBe(false);
	});

	it('an unknown top-level key', () => {
		expect(parseManifest(singleSkill({ homepage: 'https://example.com' })).success).toBe(false);
	});

	it('a non-object input with a readable error', () => {
		const result = parseManifest('not a manifest');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(typeof result.error).toBe('string');
			expect(result.error.length).toBeGreaterThan(0);
		}
	});
});
