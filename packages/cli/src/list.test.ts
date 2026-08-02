import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runList } from './list';

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
		expect(text).toContain('claude-code project (.claude/skills)\n  alpha');
		expect(text).toContain(`claude-code user (${join(home, '.claude', 'skills')})\n  charlie`);
		expect(text).toContain('codex project (.agents/skills)\n  bravo');
	});

	it('ignores loose files and sorts names within an area', () => {
		const cwd = temp('skillpass-list-cwd-');
		const home = temp('skillpass-list-home-');
		const area = join(cwd, '.claude', 'skills');
		mkdirSync(join(area, 'zulu'), { recursive: true });
		mkdirSync(join(area, 'alpha'), { recursive: true });
		writeFileSync(join(area, 'README.md'), 'not a skill');

		const result = runList({ cwd, home });
		expect(result.lines).toEqual(['claude-code project (.claude/skills)', '  alpha', '  zulu']);
	});

	it('reports a friendly empty state', () => {
		const result = runList({ cwd: temp('skillpass-list-cwd-'), home: temp('skillpass-list-home-') });
		expect(result.exitCode).toBe(0);
		expect(result.lines).toEqual(['No skills installed in the known install areas.']);
	});
});
