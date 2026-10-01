import { describe, expect, it } from 'vitest';
import { findInstallTool } from './install-tools';
import { PROMPT_TOOLS, installPrompt, installRef, toolPrompt } from './install-prompt';
import { SITE_URL } from './site';

describe('installRef', () => {
	it('is the bare slug on the latest page', () => {
		expect(installRef('pdf', '1.0.0', false)).toBe('pdf');
	});

	it('pins the version on a version permalink', () => {
		expect(installRef('pdf', '1.0.0', true)).toBe('pdf@1.0.0');
	});
});

describe('installPrompt', () => {
	const latest = installPrompt({ slug: 'pdf', version: '1.0.0', pinned: false });
	const pinned = installPrompt({ slug: 'pdf', version: '1.0.0', pinned: true });

	it('gives the exact CLI command with the same ref as the CLI tab', () => {
		expect(latest).toContain('npx skillpass@latest add pdf --target <tool>');
		expect(pinned).toContain('npx skillpass@latest add pdf@1.0.0 --target <tool>');
		expect(latest).not.toContain('pdf@');
	});

	it('names the skill and which version it means', () => {
		expect(latest).toContain('skill "pdf" (latest version)');
		expect(pinned).toContain('skill "pdf" (version 1.0.0)');
	});

	it('lists every install tool the CLI accepts, plus the --global option', () => {
		for (const tool of PROMPT_TOOLS) expect(latest).toContain(tool);
		expect(PROMPT_TOOLS).toEqual([
			'claude-code',
			'codex',
			'cursor',
			'windsurf',
			'github-copilot',
			'gemini-cli',
			'cline',
			'opencode',
		]);
		expect(latest).toContain('--global');
	});

	it('turns the medium-or-higher stop into wait-for-approval, never an automatic --yes', () => {
		expect(latest).toContain('medium or higher, show me the report and wait');
		expect(latest).toContain('Only rerun with --yes after I approve');
		expect(latest).not.toMatch(/add pdf[^\n]*--yes/);
	});

	it('asks for the installed path and a short summary', () => {
		expect(latest).toContain('installed path');
		expect(latest).toContain('two sentences');
	});

	it('links the passport, pinned to the version when the page is', () => {
		expect(latest.endsWith(`Passport: ${SITE_URL}/skills/pdf`)).toBe(true);
		expect(pinned.endsWith(`Passport: ${SITE_URL}/skills/pdf/1.0.0`)).toBe(true);
	});

	it('encodes the slug and version in the passport link only', () => {
		const out = installPrompt({ slug: 'a b', version: '1.0.0-rc.1+x', pinned: true });
		expect(out).toContain(`${SITE_URL}/skills/a%20b/1.0.0-rc.1%2Bx`);
		expect(out).toContain('add a b@1.0.0-rc.1+x --target');
	});
});

describe('toolPrompt', () => {
	const cursor = findInstallTool('cursor');
	if (!cursor) throw new Error('missing cursor');
	const out = toolPrompt(cursor);

	it('fixes the target and leaves the slug for the reader', () => {
		expect(out).toContain('npx skillpass@latest add <slug> --target cursor');
		expect(out).toContain('skill "<slug>" (latest version)');
		expect(out).not.toContain('<tool>');
		expect(out).toContain('--global');
	});

	it('keeps the same pre-flight and report steps as the skill-page prompt', () => {
		const skill = installPrompt({ slug: 'pdf', version: '1.0.0', pinned: false });
		const steps = (text: string) => text.split('\n').filter((line) => /^[23]\. /.test(line));
		expect(steps(out)).toEqual(steps(skill));
		expect(out).not.toMatch(/add <slug>[^\n]*--yes/);
	});

	it('ends with the placeholder passport link', () => {
		expect(out.endsWith(`Passport: ${SITE_URL}/skills/<slug>`)).toBe(true);
	});
});
