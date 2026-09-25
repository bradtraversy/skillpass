import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runList } from './list';
import { recordReceipt } from './receipts';

const temp = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

describe('runList', () => {
	it('lists installed skill folders per known area', () => {
		const cwd = temp('skillpass-list-cwd-');
		const home = temp('skillpass-list-home-');
		mkdirSync(join(cwd, '.claude', 'skills', 'alpha'), { recursive: true });
		mkdirSync(join(cwd, '.agents', 'skills', 'bravo'), { recursive: true });
		mkdirSync(join(home, '.claude', 'skills', 'charlie'), { recursive: true });

		const result = runList({ cwd, home });
		expect(result.exitCode).toBe(0);
		const text = result.lines.join('\n');
		expect(text).toContain('.claude/skills (project) - claude-code\n  alpha');
		expect(text).toContain(`${join(home, '.claude', 'skills')} (user) - claude-code\n  charlie`);
		expect(text).toContain(
			'.agents/skills (project) - agents, codex, cursor, windsurf, github-copilot, gemini-cli, opencode\n  bravo',
		);
	});

	it('shows versions from receipts next to installed names', () => {
		const cwd = temp('skillpass-list-cwd-');
		const home = temp('skillpass-list-home-');
		const area = join(cwd, '.claude', 'skills');
		mkdirSync(join(area, 'alpha'), { recursive: true });
		mkdirSync(join(area, 'beta'), { recursive: true });
		recordReceipt(area, 'alpha', {
			version: '1.2.0',
			sourceHash: 'sha256:abc',
			installedAt: '2026-08-02T12:00:00.000Z',
		});
		const result = runList({ cwd, home });
		expect(result.lines).toEqual(['.claude/skills (project) - claude-code', '  alpha  1.2.0', '  beta']);
	});

	it('ignores loose files and sorts names within an area', () => {
		const cwd = temp('skillpass-list-cwd-');
		const home = temp('skillpass-list-home-');
		const area = join(cwd, '.claude', 'skills');
		mkdirSync(join(area, 'zulu'), { recursive: true });
		mkdirSync(join(area, 'alpha'), { recursive: true });
		writeFileSync(join(area, 'README.md'), 'not a skill');

		const result = runList({ cwd, home });
		expect(result.lines).toEqual(['.claude/skills (project) - claude-code', '  alpha', '  zulu']);
	});

	it('ignores a dangling symlink instead of crashing', () => {
		const cwd = temp('skillpass-list-cwd-');
		const home = temp('skillpass-list-home-');
		const area = join(cwd, '.claude', 'skills');
		mkdirSync(join(area, 'alpha'), { recursive: true });
		symlinkSync(join(area, 'missing'), join(area, 'ghost'));

		const result = runList({ cwd, home });
		expect(result.lines).toEqual(['.claude/skills (project) - claude-code', '  alpha']);
	});

	it('reports a friendly empty state', () => {
		const result = runList({ cwd: temp('skillpass-list-cwd-'), home: temp('skillpass-list-home-') });
		expect(result.exitCode).toBe(0);
		expect(result.lines).toEqual(['No skills installed in the known install areas.']);
	});
});
