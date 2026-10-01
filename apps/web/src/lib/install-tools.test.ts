import { describe, expect, it } from 'vitest';
import { findInstallTool, INSTALL_TOOLS, sharedWith } from './install-tools';

const AGENTS_READERS = ['codex', 'cursor', 'windsurf', 'github-copilot', 'gemini-cli', 'opencode'];

describe('INSTALL_TOOLS', () => {
	it('lists the eight CLI install tools in prompt order', () => {
		expect(INSTALL_TOOLS.map((tool) => tool.slug)).toEqual([
			'claude-code',
			'codex',
			'cursor',
			'windsurf',
			'github-copilot',
			'gemini-cli',
			'cline',
			'opencode',
		]);
	});

	it('gives Claude Code its own layout and folders', () => {
		expect(findInstallTool('claude-code')).toEqual({
			slug: 'claude-code',
			name: 'Claude Code',
			project: '.claude/skills',
			user: '~/.claude/skills',
			layout: 'claude-code',
		});
	});

	it('gives Cline its own folders in the .agents layout', () => {
		expect(findInstallTool('cline')).toMatchObject({
			project: '.cline/skills',
			user: '~/.cline/skills',
			layout: 'agents',
		});
	});

	it.each(AGENTS_READERS)('points %s at the shared .agents folders', (slug) => {
		expect(findInstallTool(slug)).toMatchObject({
			project: '.agents/skills',
			user: '~/.agents/skills',
			layout: 'agents',
		});
	});

	it('has a display name for every tool', () => {
		for (const tool of INSTALL_TOOLS) expect(tool.name).not.toBe('');
	});
});

describe('findInstallTool', () => {
	it('returns undefined for unknown names and object prototype keys', () => {
		expect(findInstallTool('vim')).toBeUndefined();
		expect(findInstallTool('agents')).toBeUndefined();
		expect(findInstallTool('constructor')).toBeUndefined();
	});
});

describe('sharedWith', () => {
	it('lists the other .agents readers for each of them', () => {
		for (const slug of AGENTS_READERS) {
			const tool = findInstallTool(slug);
			if (!tool) throw new Error(`missing ${slug}`);
			expect(sharedWith(tool).map((other) => other.slug)).toEqual(AGENTS_READERS.filter((s) => s !== slug));
		}
	});

	it('is empty for Claude Code and Cline', () => {
		for (const slug of ['claude-code', 'cline']) {
			const tool = findInstallTool(slug);
			if (!tool) throw new Error(`missing ${slug}`);
			expect(sharedWith(tool)).toEqual([]);
		}
	});
});
