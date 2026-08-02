import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runRemove } from './remove';

const temp = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

function installSkill(dir: string) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'SKILL.md'), '# demo\n');
}

function ctx() {
	return { cwd: temp('skillpass-rm-cwd-'), home: temp('skillpass-rm-home-') };
}

describe('runRemove', () => {
	it('removes by --target', () => {
		const { cwd, home } = ctx();
		const dir = join(cwd, '.claude', 'skills', 'demo');
		installSkill(dir);
		const result = runRemove('demo', { target: 'claude-code', cwd, home });
		expect(result.exitCode).toBe(0);
		expect(result.lines[0]).toContain('Removed demo');
		expect(existsSync(dir)).toBe(false);
	});

	it('removes a single search hit without flags', () => {
		const { cwd, home } = ctx();
		const dir = join(home, '.claude', 'skills', 'demo');
		installSkill(dir);
		const result = runRemove('demo', { cwd, home });
		expect(result.exitCode).toBe(0);
		expect(existsSync(dir)).toBe(false);
	});

	it('lists locations and refuses when the slug is installed in several places', () => {
		const { cwd, home } = ctx();
		const first = join(cwd, '.claude', 'skills', 'demo');
		const second = join(cwd, '.agents', 'skills', 'demo');
		installSkill(first);
		installSkill(second);
		const result = runRemove('demo', { cwd, home });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('more than one place');
		expect(result.lines.join('\n')).toContain(first);
		expect(result.lines.join('\n')).toContain(second);
		expect(existsSync(first)).toBe(true);
		expect(existsSync(second)).toBe(true);
	});

	it('errors when the skill is not installed anywhere', () => {
		const { cwd, home } = ctx();
		const result = runRemove('ghost', { cwd, home });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('not installed');
	});

	it('refuses a directory without an installed-skill marker', () => {
		const { cwd, home } = ctx();
		const dir = join(cwd, 'precious-data');
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, 'notes.txt'), 'irreplaceable');
		const result = runRemove('demo', { dir, cwd, home });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('does not look like an installed skill');
		expect(existsSync(join(dir, 'notes.txt'))).toBe(true);
	});

	it('errors cleanly when --dir points at a file', () => {
		const { cwd, home } = ctx();
		const file = join(cwd, 'iamafile');
		writeFileSync(file, 'hello');
		const result = runRemove('demo', { dir: file, cwd, home });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('not a directory');
	});

	it('rejects --global without --target and --target with --dir', () => {
		const { cwd, home } = ctx();
		expect(runRemove('demo', { global: true, cwd, home }).lines[0]).toContain(
			'--global needs --target',
		);
		expect(runRemove('demo', { target: 'claude-code', dir: './x', cwd, home }).lines[0]).toContain(
			'not both',
		);
	});

	it('removes from the user area with --target --global', () => {
		const { cwd, home } = ctx();
		const dir = join(home, '.claude', 'skills', 'demo');
		installSkill(dir);
		const result = runRemove('demo', { target: 'claude-code', global: true, cwd, home });
		expect(result.exitCode).toBe(0);
		expect(existsSync(dir)).toBe(false);
	});
});
