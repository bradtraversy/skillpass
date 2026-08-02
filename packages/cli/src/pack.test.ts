import type { SkillEntry } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { resolvePackMembers } from './pack';

const paired: SkillEntry = {
	name: 'adopt',
	entry: '.claude/skills/adopt/SKILL.md',
	targets: ['claude-code', 'codex'],
	variants: { codex: '.agents/skills/adopt/SKILL.md' },
};

const flat: SkillEntry = {
	name: 'deploy',
	entry: 'skills/deploy/SKILL.md',
};

const claudeOnly: SkillEntry = {
	name: 'niche',
	entry: '.claude/skills/niche/SKILL.md',
	targets: ['claude-code'],
};

describe('resolvePackMembers', () => {
	it('picks the variant path for the requested target', () => {
		const { installs, skipped } = resolvePackMembers([paired], 'codex');
		expect(installs).toEqual([{ name: 'adopt', sourceDir: '.agents/skills/adopt' }]);
		expect(skipped).toEqual([]);
	});

	it('falls back to the entry when the target is supported without a variant', () => {
		const { installs } = resolvePackMembers([paired], 'claude-code');
		expect(installs).toEqual([{ name: 'adopt', sourceDir: '.claude/skills/adopt' }]);
	});

	it('serves any target from the entry when no targets are declared', () => {
		const { installs } = resolvePackMembers([flat], 'cursor');
		expect(installs).toEqual([{ name: 'deploy', sourceDir: 'skills/deploy' }]);
	});

	it('skips members that cannot serve the target, visibly', () => {
		const { installs, skipped } = resolvePackMembers([paired, claudeOnly], 'codex');
		expect(installs.map((i) => i.name)).toEqual(['adopt']);
		expect(skipped).toEqual(['niche']);
	});
});
