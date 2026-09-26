import { loadPackageFromFiles, validateLoadedPackage } from 'validator';
import { describe, expect, it } from 'vitest';
import { findingLine, permissionLine, renderFindings, renderLocalPreflight, renderPermissions } from './render';

describe('permissionLine', () => {
	it('adds the taxonomy label', () => {
		expect(permissionLine('network.fetch')).toBe('network.fetch - Fetch from the network');
	});
});

describe('findingLine', () => {
	it('includes path and line when present', () => {
		expect(
			findingLine({
				code: 'SECRET_LEAKED',
				message: 'looks like a credential',
				location: { path: 'skill.json', line: 3 },
			}),
		).toBe('  SECRET_LEAKED [skill.json:3] looks like a credential');
	});

	it('omits the location bracket when absent', () => {
		expect(findingLine({ code: 'X', message: 'no location' })).toBe('  X no location');
	});
});

describe('renderFindings', () => {
	it('is empty for no findings', () => {
		expect(renderFindings('Failures', [])).toEqual([]);
	});
});

describe('renderPermissions', () => {
	it('marks empty sets as none', () => {
		const lines = renderPermissions([], ['env.read']);
		expect(lines).toContain('    (none)');
		expect(lines.join('\n')).toContain('env.read - ');
	});
});

describe('renderLocalPreflight', () => {
	const SHA = 'c'.repeat(40);
	const origin = { repo: 'o/r', commit: SHA };
	const NOW = new Date('2026-09-25T12:00:00Z');

	it('renders a passing single skill with the unlisted marker and no diff', async () => {
		const pkg = loadPackageFromFiles([{ path: 'SKILL.md', content: '# notes\n\nSummarize things.\n' }], 'notes');
		const report = await validateLoadedPackage(pkg, { now: NOW });
		const lines = renderLocalPreflight('notes', origin, pkg, report);
		expect(lines[0]).toBe('Skill     notes (unlisted - validated locally, not on the directory)');
		expect(lines).toContain('Repo      github.com/o/r');
		expect(lines).toContain(`Commit    ${SHA}`);
		expect(lines).toContain('Version   none declared');
		expect(lines).toContain('Status    PASSED');
		expect(lines).toContain('Risk      low');
		expect(lines).toContain(`Source    ${report.sourceHash} (validated locally)`);
		expect(lines).toContain('Validated 2026-09-25');
		expect(lines).toContain('Changes   not tracked for unlisted installs');
		expect(lines.join('\n')).not.toContain('BLOCKED');
		expect(lines.join('\n')).not.toContain('Pack ');
	});

	it('names pack members, the subpath, and a declared version', async () => {
		const pkg = loadPackageFromFiles(
			[
				{ path: '.claude/skills/adopt/SKILL.md', content: '# adopt\n' },
				{ path: '.claude/skills/audit/SKILL.md', content: '# audit\n' },
				{ path: 'README.md', content: 'A pack.\n' },
			],
			'r',
		);
		const report = await validateLoadedPackage(pkg, { now: NOW });
		const lines = renderLocalPreflight('r', { ...origin, subpath: 'tools' }, pkg, report);
		expect(lines).toContain('Pack      2 skills: adopt, audit');
		expect(lines).toContain('Repo      github.com/o/r/tools');
		const versioned = loadPackageFromFiles(
			[{ path: 'SKILL.md', content: '---\nname: notes\nversion: 1.2.0\n---\n# notes\n' }],
			'notes',
		);
		const versionedReport = await validateLoadedPackage(versioned, { now: NOW });
		expect(renderLocalPreflight('notes', origin, versioned, versionedReport)).toContain('Version   1.2.0');
	});

	it('lists findings and ends with BLOCKED for a failed report', async () => {
		const pkg = loadPackageFromFiles(
			[{ path: 'SKILL.md', content: `# leak\n\nUse ghp_${'x'.repeat(36)} to sign in.\n` }],
			'leak',
		);
		const report = await validateLoadedPackage(pkg, { now: NOW });
		const lines = renderLocalPreflight('leak', origin, pkg, report);
		expect(lines).toContain('Status    FAILED');
		expect(lines.join('\n')).toContain('Failures (1)');
		expect(lines.join('\n')).toContain('secret-pattern');
		expect(lines.at(-1)).toBe('BLOCKED: validation failed; failed skills cannot be installed');
	});
});
