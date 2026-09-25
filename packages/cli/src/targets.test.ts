import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	declaresTool,
	INSTALL_TOOL_NAMES,
	knownAreas,
	layoutTarget,
	mappableDeclaredTargets,
	resolveArea,
	resolveTargetDir,
} from './targets';

const HOME = join('/tmp', 'skillpass-home');

describe('resolveTargetDir', () => {
	it('maps claude-code to the project skills folder', () => {
		expect(resolveTargetDir('claude-code', 'smoke-clean')).toEqual({
			ok: true,
			dir: join('.claude', 'skills', 'smoke-clean'),
		});
	});

	it('maps claude-code --global to the home skills folder', () => {
		expect(resolveTargetDir('claude-code', 'smoke-clean', true)).toEqual({
			ok: true,
			dir: join(homedir(), '.claude', 'skills', 'smoke-clean'),
		});
	});

	it('maps codex to the agents skills folder', () => {
		expect(resolveTargetDir('codex', 'smoke-clean')).toEqual({
			ok: true,
			dir: join('.agents', 'skills', 'smoke-clean'),
		});
	});

	it.each(['agents', 'codex', 'cursor', 'windsurf', 'github-copilot', 'gemini-cli', 'opencode'])(
		'maps %s to the shared .agents folders',
		(tool) => {
			expect(resolveTargetDir(tool, 'x')).toEqual({ ok: true, dir: join('.agents', 'skills', 'x') });
			expect(resolveTargetDir(tool, 'x', true, HOME)).toEqual({ ok: true, dir: join(HOME, '.agents', 'skills', 'x') });
		},
	);

	it('maps cline to its own folders', () => {
		expect(resolveTargetDir('cline', 'x')).toEqual({ ok: true, dir: join('.cline', 'skills', 'x') });
		expect(resolveTargetDir('cline', 'x', true, HOME)).toEqual({ ok: true, dir: join(HOME, '.cline', 'skills', 'x') });
	});

	it('points declared-only tools at --dir', () => {
		const result = resolveTargetDir('aider', 'smoke-clean');
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.message).toContain('use --dir');
	});

	it('rejects an unknown tool with every install tool', () => {
		const result = resolveTargetDir('vim', 'smoke-clean');
		expect(result.ok).toBe(false);
		for (const tool of INSTALL_TOOL_NAMES) {
			expect(result.ok === false && result.message).toContain(tool);
		}
	});
});

describe('layoutTarget and declaresTool', () => {
	it('reads the claude layout for claude-code and the agents standard elsewhere', () => {
		expect(layoutTarget('claude-code')).toBe('claude-code');
		expect(layoutTarget('cursor')).toBe('codex');
		expect(layoutTarget('cline')).toBe('codex');
		expect(layoutTarget('vim')).toBeUndefined();
	});

	it('accepts a skill that declares the tool or its layout', () => {
		expect(declaresTool(['codex'], 'cursor')).toBe(true);
		expect(declaresTool(['cursor'], 'cursor')).toBe(true);
		expect(declaresTool(['claude-code'], 'cursor')).toBe(false);
		expect(declaresTool(['codex'], 'claude-code')).toBe(false);
	});
});

describe('mappableDeclaredTargets', () => {
	it('keeps only declared targets that are install tools', () => {
		expect(mappableDeclaredTargets(['cursor', 'claude-code', 'aider'])).toEqual(['cursor', 'claude-code']);
	});
});

describe('knownAreas', () => {
	const areas = knownAreas('/work', HOME);

	it('lists each folder once, project and user, in registry order', () => {
		expect(areas.map((a) => a.dir)).toEqual([
			resolve('/work', '.claude', 'skills'),
			join(HOME, '.claude', 'skills'),
			resolve('/work', '.agents', 'skills'),
			join(HOME, '.agents', 'skills'),
			resolve('/work', '.cline', 'skills'),
			join(HOME, '.cline', 'skills'),
		]);
	});

	it('names every tool that reads the shared folder', () => {
		const shared = areas.find((a) => a.dir === resolve('/work', '.agents', 'skills'));
		expect(shared?.tools).toEqual([
			'agents',
			'codex',
			'cursor',
			'windsurf',
			'github-copilot',
			'gemini-cli',
			'opencode',
		]);
		expect(shared?.layout).toBe('codex');
		expect(shared?.global).toBe(false);
		expect(shared?.label).toBe(
			`${join('.agents', 'skills')} (project) - agents, codex, cursor, windsurf, github-copilot, gemini-cli, opencode`,
		);
	});

	it('labels a user-level area with its absolute path', () => {
		const claude = areas.find((a) => a.dir === join(HOME, '.claude', 'skills'));
		expect(claude?.label).toBe(`${join(HOME, '.claude', 'skills')} (user) - claude-code`);
	});
});

describe('resolveArea', () => {
	it('returns the shared area for any tool that reads it', () => {
		const result = resolveArea('gemini-cli', true, '/work', HOME);
		expect(result.ok).toBe(true);
		expect(result.ok && result.area.dir).toBe(join(HOME, '.agents', 'skills'));
		expect(result.ok && result.area.tools).toContain('cursor');
	});

	it('passes the resolver error through', () => {
		const result = resolveArea('vim', false, '/work', HOME);
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.message).toContain('unknown target');
	});
});
