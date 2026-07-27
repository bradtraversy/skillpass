import { describe, expect, it } from 'vitest';
import { firstSentence, monogram, repoHandle, timeAgo } from './format';

describe('monogram', () => {
	it('uses first and last word initials', () => {
		expect(monogram('Commit Message Writer')).toBe('CW');
		expect(monogram('Gmail Sweep')).toBe('GS');
	});

	it('uses the first two letters for a single word', () => {
		expect(monogram('Memcrate')).toBe('ME');
	});

	it('uppercases and tolerates extra whitespace', () => {
		expect(monogram('  repo   triage  ')).toBe('RT');
	});

	it('returns an empty string for an empty name', () => {
		expect(monogram('')).toBe('');
	});
});

describe('timeAgo', () => {
	const now = new Date('2026-07-07T18:00:00Z');

	it('renders sub-minute and future timestamps as just now', () => {
		expect(timeAgo('2026-07-07T17:59:30Z', now)).toBe('just now');
		expect(timeAgo('2026-07-07T19:00:00Z', now)).toBe('just now');
	});

	it('steps through minutes, hours, and days', () => {
		expect(timeAgo('2026-07-07T17:15:00Z', now)).toBe('45m ago');
		expect(timeAgo('2026-07-07T11:00:00Z', now)).toBe('7h ago');
		expect(timeAgo('2026-07-04T18:00:00Z', now)).toBe('3d ago');
	});

	it('rolls into months and years', () => {
		expect(timeAgo('2026-05-01T18:00:00Z', now)).toBe('2mo ago');
		expect(timeAgo('2024-06-01T18:00:00Z', now)).toBe('2y ago');
	});
});

describe('repoHandle', () => {
	it('extracts owner/repo from a plain GitHub URL', () => {
		expect(repoHandle('https://github.com/aria-dev/pr-review-bot')).toBe('aria-dev/pr-review-bot');
	});

	it('tolerates a trailing slash', () => {
		expect(repoHandle('https://github.com/aria-dev/pr-review-bot/')).toBe('aria-dev/pr-review-bot');
	});

	it('strips a .git suffix', () => {
		expect(repoHandle('https://github.com/aria-dev/pr-review-bot.git')).toBe('aria-dev/pr-review-bot');
	});

	it('falls back to the raw input for a non-GitHub or malformed URL', () => {
		expect(repoHandle('not a url')).toBe('not a url');
		expect(repoHandle('https://gitlab.com/aria-dev/pr-review-bot')).toBe(
			'https://gitlab.com/aria-dev/pr-review-bot',
		);
	});
});

describe('firstSentence', () => {
	it('drops the trigger clause after the first sentence', () => {
		expect(
			firstSentence('Finds similar bugs across codebases. Use when hunting bug variants.'),
		).toBe('Finds similar bugs across codebases.');
	});

	it('returns a single sentence unchanged', () => {
		expect(firstSentence('Detects missing zeroization of sensitive data.')).toBe(
			'Detects missing zeroization of sensitive data.',
		);
	});

	it('returns the whole text when there is no terminator', () => {
		expect(firstSentence('Mutation-driven test vector generation')).toBe(
			'Mutation-driven test vector generation',
		);
	});

	it('does not split on a dot inside a version or path', () => {
		expect(firstSentence('Targets Node 22.12 runtimes and up. Second sentence.')).toBe(
			'Targets Node 22.12 runtimes and up.',
		);
	});
});
