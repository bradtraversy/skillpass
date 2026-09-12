import type { PublicSkillSummary } from 'skill-schema';
import { describe, expect, it, vi } from 'vitest';
import { runSearch } from './search';

function skill(overrides: Partial<PublicSkillSummary> = {}): PublicSkillSummary {
	return {
		slug: 'clean-skill',
		name: 'clean-skill',
		summary: 'A tidy demo skill.',
		targets: ['claude-code'],
		validationStatus: 'passed',
		riskLevel: 'low',
		version: '1.0.0',
		maintainer: 'somedev',
		attributedTo: null,
		featured: false,
		verified: false,
		publishedAt: '2026-07-07T18:24:19.337Z',
		...overrides,
	};
}

const SKILLS = [
	skill(),
	skill({
		slug: 'pdf',
		name: 'pdf',
		summary: 'Read and edit PDF files.',
		maintainer: 'bradtraversy',
		attributedTo: 'anthropics',
		tagline: 'Read, edit, and create PDF files.',
	}),
	skill({
		slug: 'ai-blueprint',
		name: 'ai-blueprint',
		summary: 'Planning docs become project context.',
		targets: ['claude-code', 'codex'],
		riskLevel: 'medium',
		category: 'agent-workflow',
		packSkills: ['adopt', 'feature', 'implement'],
	}),
];

function stubFetch(payload: unknown = { success: true, data: SKILLS }) {
	return vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
}

describe('runSearch', () => {
	it('lists everything with no query, aligned with a footer', async () => {
		const result = await runSearch({ fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(result.lines.at(-1)).toBe('3 of 3 skills - skillpass report <slug> shows the passport');
		expect(result.lines[0]).toMatch(/^clean-skill {2,}somedev/);
	});

	it('matches each site haystack field', async () => {
		for (const query of ['pdf', 'tidy demo', 'bradtraversy', 'anthropics', 'codex', 'implement']) {
			const result = await runSearch({ query, fetchImpl: stubFetch() });
			expect(result.exitCode, query).toBe(0);
			expect(result.lines.at(-1), query).toMatch(/^1 of 3 skills/);
		}
	});

	it('shows elevated risk, the PACK marker, and the curated author', async () => {
		const result = await runSearch({ fetchImpl: stubFetch() });
		const text = result.lines.join('\n');
		expect(text).toMatch(/ai-blueprint\s+medium\s+PACK 3\s+somedev/);
		expect(text).toMatch(/pdf\s+anthropics\s+Read, edit, and create PDF files\./);
		expect(text).not.toMatch(/\blow\b/);
	});

	it('filters by --target, --category, and --packs, composed with a query', async () => {
		const target = await runSearch({ target: 'codex', fetchImpl: stubFetch() });
		expect(target.lines.at(-1)).toMatch(/^1 of 3/);
		const category = await runSearch({ category: 'agent-workflow', fetchImpl: stubFetch() });
		expect(category.lines.at(-1)).toMatch(/^1 of 3/);
		const packs = await runSearch({ packs: true, fetchImpl: stubFetch() });
		expect(packs.lines.at(-1)).toMatch(/^1 of 3/);
		const composed = await runSearch({ packs: true, query: 'zzz', fetchImpl: stubFetch() });
		expect(composed.lines[0]).toContain('No skills match');
	});

	it('rejects unknown targets and categories with exit 2', async () => {
		const fetchImpl = stubFetch();
		const target = await runSearch({ target: 'notepad', fetchImpl });
		expect(target.exitCode).toBe(2);
		expect(target.lines[0]).toContain('unknown target');
		const category = await runSearch({ category: 'nonsense', fetchImpl });
		expect(category.exitCode).toBe(2);
		expect(category.lines[0]).toContain('unknown category');
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('returns a friendly empty result with exit 0', async () => {
		const result = await runSearch({ query: 'zzz-nothing', fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		expect(result.lines).toEqual(['No skills match - 3 listed at skillpass.dev']);
	});

	it('prints the filtered array with --json', async () => {
		const result = await runSearch({ packs: true, json: true, fetchImpl: stubFetch() });
		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.lines.join('\n')) as PublicSkillSummary[];
		expect(parsed.map((s) => s.slug)).toEqual(['ai-blueprint']);
	});

	it('keeps the aligned table when rows fit the width', async () => {
		const result = await runSearch({ width: 200, fetchImpl: stubFetch() });
		expect(result.lines[0]).toMatch(/^clean-skill {2,}somedev/);
		expect(result.lines.filter((l) => l !== '').length).toBe(4);
	});

	it('switches to two-line rows with a truncated tagline when too narrow', async () => {
		const result = await runSearch({ width: 40, fetchImpl: stubFetch() });
		expect(result.lines[0]).toBe('clean-skill  somedev');
		expect(result.lines[1]).toBe('  A tidy demo skill.');
		expect(result.lines[2]).toBe('');
		const packHeader = result.lines.find((l) => l.startsWith('ai-blueprint'));
		expect(packHeader).toBe('ai-blueprint  medium  PACK 3  somedev');
		for (const line of result.lines.slice(0, -2)) {
			expect(line.length).toBeLessThanOrEqual(40);
		}

		const tight = await runSearch({ width: 20, fetchImpl: stubFetch() });
		const taglines = tight.lines.filter((l) => l.startsWith('  '));
		expect(taglines.every((l) => l.length <= 20)).toBe(true);
		expect(taglines.some((l) => l.endsWith('...'))).toBe(true);
	});

	it('emits full single-line rows when no width is given', async () => {
		const result = await runSearch({ fetchImpl: stubFetch() });
		expect(result.lines.filter((l) => l !== '').length).toBe(4);
		expect(result.lines.join('\n')).toContain('Read, edit, and create PDF files.');
	});

	it('colors slug, elevated risk, pack, and author without breaking alignment', async () => {
		const { ANSI } = await import('./style');
		const result = await runSearch({ width: 200, style: ANSI, fetchImpl: stubFetch() });
		expect(result.lines[0]).toContain('\x1b[1mclean-skill');
		expect(result.lines[0]).toContain('\x1b[33msomedev');
		expect(result.lines[0]).not.toContain('low');
		const packRow = result.lines.find((l) => l.includes('ai-blueprint'));
		expect(packRow).toContain('\x1b[33mmedium');
		expect(packRow).toContain('\x1b[36mPACK 3');
		expect(result.lines.at(-1)).toContain('\x1b[2m3 of 3 skills');

		const narrow = await runSearch({ width: 40, style: ANSI, fetchImpl: stubFetch() });
		expect(narrow.lines[0]).toBe('\x1b[1mclean-skill\x1b[22m  \x1b[33msomedev\x1b[39m');
		expect(narrow.lines[1]).toBe('\x1b[2m  A tidy demo skill.\x1b[22m');
	});

	it('errors on a contract mismatch and on network failure', async () => {
		const bad = await runSearch({ fetchImpl: stubFetch({ success: true, data: [{ nope: 1 }] }) });
		expect(bad.exitCode).toBe(2);
		expect(bad.lines[0]).toContain('did not match the expected contract');
		const down = vi.fn(async () => {
			throw new Error('offline');
		}) as unknown as typeof fetch;
		const network = await runSearch({ fetchImpl: down });
		expect(network.exitCode).toBe(2);
		expect(network.lines[0]).toContain('cannot reach the API');
	});
});
