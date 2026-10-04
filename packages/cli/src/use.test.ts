import { strToU8, zipSync } from 'fflate';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PublicPreflight, PublicSkillDetail } from 'skill-schema';
import { loadPackageFromFiles, type PackageFile } from 'validator';
import { describe, expect, it, vi } from 'vitest';
import { buildPrompt, runUse } from './use';

const FILES: PackageFile[] = [
	{
		path: 'SKILL.md',
		content: '---\nname: pdf-notes\ndescription: Summarize PDFs.\n---\n\n# PDF Notes\n\nRead reference.md first.\n',
	},
	{ path: 'reference.md', content: 'Notes on PDF structure.\n' },
];
const hashOf = (files: PackageFile[]) => loadPackageFromFiles(files).sourceHash;
const zipOf = (files: PackageFile[]) => zipSync(Object.fromEntries(files.map((f) => [f.path, strToU8(f.content)])));

const detail: PublicSkillDetail = {
	slug: 'pdf-notes',
	name: 'pdf-notes',
	summary: 'Summarize PDFs.',
	targets: ['claude-code'],
	validationStatus: 'passed',
	riskLevel: 'low',
	version: '1.0.0',
	maintainer: 'bradtraversy',
	attributedTo: null,
	featured: false,
	verified: false,
	publishedAt: '2026-10-03T12:00:00.000Z',
	githubRepoUrl: null,
	passport: {
		schemaVersion: '0.1',
		validationStatus: 'passed',
		riskLevel: 'low',
		permissionsSummary: { declared: [], detected: [] },
		warningsSummary: [],
		distribution: 'skill',
		manifestInferred: true,
		sourceHash: hashOf(FILES),
		engineVersion: '0.3.1',
		generatedAt: '2026-10-03T12:00:00.000Z',
	},
	maintainerInfo: { username: 'bradtraversy', displayName: 'Brad Traversy', avatarUrl: 'https://example.com/a.png' },
	versions: [
		{ version: '1.0.0', validationStatus: 'passed', riskLevel: 'low', publishedAt: '2026-10-03T12:00:00.000Z' },
	],
	aiReview: null,
};

const preflight: PublicPreflight = {
	version: '1.0.0',
	validationStatus: 'passed',
	riskLevel: 'low',
	sourceHash: hashOf(FILES),
	sourceVerified: true,
	resolvedCommitSha: null,
	generatedAt: '2026-10-03T12:00:00.000Z',
	permissions: { declared: [], detected: [] },
	diff: null,
	blocked: false,
	blockedReason: null,
};

function stubFetch(
	overrides: {
		detail?: Partial<PublicSkillDetail>;
		preflight?: Partial<PublicPreflight>;
		files?: PackageFile[];
		status?: number;
	} = {},
) {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (overrides.status)
			return new Response(JSON.stringify({ success: false, error: 'not found' }), { status: overrides.status });
		if (url.includes('/download')) return new Response(zipOf(overrides.files ?? FILES).slice().buffer, { status: 200 });
		if (url.endsWith('/preflight')) {
			return new Response(JSON.stringify({ success: true, data: { ...preflight, ...overrides.preflight } }), {
				status: 200,
			});
		}
		return new Response(JSON.stringify({ success: true, data: { ...detail, ...overrides.detail } }), { status: 200 });
	}) as unknown as typeof fetch;
}

function harness(
	fetchImpl: typeof fetch,
	extra: { yes?: boolean; confirmImpl?: (q: string) => Promise<boolean> } = {},
) {
	const stderr: string[] = [];
	const tmpRoot = mkdtempSync(join(tmpdir(), 'skillpass-use-test-'));
	const run = (ref = 'pdf-notes') =>
		runUse(ref, { fetchImpl, apiUrl: 'https://api.test', tmpRoot, emit: (text) => stderr.push(text), ...extra });
	return { run, stderr, tmpRoot };
}

describe('runUse', () => {
	it('unpacks the verified snapshot and returns only the prompt', async () => {
		const { run, stderr, tmpRoot } = harness(stubFetch());
		const result = await run();
		expect(result.exitCode).toBe(0);
		expect(result.lines).toHaveLength(1);
		const [prompt] = result.lines;
		const [useDir] = readdirSync(tmpRoot);
		const dir = join(tmpRoot, useDir, 'pdf-notes');
		expect(readFileSync(join(dir, 'reference.md'), 'utf8')).toBe('Notes on PDF structure.\n');
		expect(prompt).toContain('Use the "pdf-notes" agent skill (pdf-notes@1.0.0, validated by SkillPass)');
		expect(prompt).toContain(`Its files are in ${dir}`);
		expect(prompt).toContain('Read reference.md first.');
		expect(prompt).not.toContain('Status');
		const report = stderr.join('\n');
		expect(report).toContain('Status    PASSED');
		expect(report).toContain(`Unpacked to ${dir}`);
	});

	it('stops a blocked version with exit 1 and writes nothing', async () => {
		const { run, stderr, tmpRoot } = harness(
			stubFetch({
				preflight: { blocked: true, validationStatus: 'failed', riskLevel: 'high', blockedReason: 'validation failed' },
			}),
		);
		const result = await run();
		expect(result).toEqual({ lines: [], exitCode: 1, streamed: true });
		expect(stderr.join('\n')).toContain('BLOCKED');
		expect(readdirSync(tmpRoot)).toEqual([]);
	});

	it('needs a confirmation for medium risk', async () => {
		const medium = { preflight: { riskLevel: 'medium' as const, validationStatus: 'warning' as const } };

		const noTty = harness(stubFetch(medium));
		expect((await noTty.run()).exitCode).toBe(2);
		expect(noTty.stderr.join('\n')).toContain('needs confirmation; rerun with --yes');
		expect(readdirSync(noTty.tmpRoot)).toEqual([]);

		const declined = harness(stubFetch(medium), { confirmImpl: () => Promise.resolve(false) });
		expect((await declined.run()).exitCode).toBe(2);
		expect(declined.stderr.join('\n')).toContain('Cancelled; nothing was run.');

		const question = vi.fn(() => Promise.resolve(true));
		const confirmed = harness(stubFetch(medium), { confirmImpl: question });
		expect((await confirmed.run()).exitCode).toBe(0);
		expect(question).toHaveBeenCalledWith('Use pdf-notes@1.0.0 (medium risk)? [y/N] ');

		expect((await harness(stubFetch(medium), { yes: true }).run()).exitCode).toBe(0);
	});

	it('refuses a download that does not match the pinned hash', async () => {
		const tampered = [...FILES, { path: 'extra.md', content: 'not reviewed\n' }];
		const { run, stderr, tmpRoot } = harness(stubFetch({ files: tampered }));
		expect((await run()).exitCode).toBe(2);
		expect(stderr.join('\n')).toContain('do not match the pinned source hash');
		expect(readdirSync(tmpRoot)).toEqual([]);
	});

	it('refuses a pack, a repo reference, and an unknown slug', async () => {
		const pack = harness(
			stubFetch({
				detail: {
					packMembers: [
						{ name: 'a', entry: 'skills/a/SKILL.md' },
						{ name: 'b', entry: 'skills/b/SKILL.md' },
					],
				},
			}),
		);
		expect((await pack.run()).exitCode).toBe(2);
		expect(pack.stderr.join('\n')).toContain('is a pack of 2 skills; use runs one skill');

		const fetchImpl = stubFetch();
		const repo = harness(fetchImpl);
		expect((await repo.run('github:owner/repo')).exitCode).toBe(2);
		expect(repo.stderr[0]).toContain('skillpass add github:owner/repo');
		expect(fetchImpl).not.toHaveBeenCalled();

		const missing = harness(stubFetch({ status: 404 }));
		expect((await missing.run('nope')).exitCode).toBe(2);
		expect(missing.stderr.join('\n')).toContain('nope is not published on the directory');
	});

	it('refuses a snapshot without a root SKILL.md', async () => {
		const nested = [{ path: 'skills/pdf-notes/SKILL.md', content: '# nested\n' }];
		const { run, stderr, tmpRoot } = harness(stubFetch({ files: nested, preflight: { sourceHash: hashOf(nested) } }));
		expect((await run()).exitCode).toBe(2);
		expect(stderr.join('\n')).toContain('has no SKILL.md at its root');
		expect(readdirSync(tmpRoot)).toEqual([]);
	});
});

describe('buildPrompt', () => {
	it('puts the header and folder before the skill body', () => {
		const prompt = buildPrompt({
			name: 'pdf',
			slug: 'pdf',
			version: '1.0.0',
			dir: '/tmp/x/pdf',
			skillMd: '# PDF\n\n\n',
		});
		expect(prompt).toBe(
			'Use the "pdf" agent skill (pdf@1.0.0, validated by SkillPass) for this task.\nIts files are in /tmp/x/pdf; when the instructions below refer to other files, read them from that folder.\n\n# PDF\n',
		);
	});
});
