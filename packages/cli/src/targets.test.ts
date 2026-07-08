import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mappableDeclaredTargets, resolveTargetDir } from './targets';

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

	it('refuses --global for a tool without a user-level folder', () => {
		const result = resolveTargetDir('codex', 'smoke-clean', true);
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.message).toContain('no user-level skills folder');
	});

	it('points unmapped tools at --dir', () => {
		const result = resolveTargetDir('cursor', 'smoke-clean');
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.message).toContain('use --dir');
	});

	it('rejects an unknown tool with the known list', () => {
		const result = resolveTargetDir('vim', 'smoke-clean');
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.message).toContain('claude-code');
	});
});

describe('mappableDeclaredTargets', () => {
	it('keeps only tools with install areas', () => {
		expect(mappableDeclaredTargets(['cursor', 'claude-code', 'aider'])).toEqual(['claude-code']);
	});
});
