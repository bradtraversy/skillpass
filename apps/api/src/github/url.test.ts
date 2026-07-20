import { describe, expect, it } from 'vitest';
import { parseGithubUrl } from './url';

describe('parseGithubUrl accepted forms', () => {
	it('parses a plain repo URL', () => {
		expect(parseGithubUrl('https://github.com/bradtraversy/skillpass')).toEqual({
			success: true,
			data: { owner: 'bradtraversy', repo: 'skillpass' },
		});
	});

	it('tolerates a trailing slash and a .git suffix', () => {
		expect(parseGithubUrl('https://github.com/octocat/hello.git/')).toEqual({
			success: true,
			data: { owner: 'octocat', repo: 'hello' },
		});
	});

	it('parses a tree URL with a ref', () => {
		expect(parseGithubUrl('https://github.com/octocat/hello/tree/main')).toEqual({
			success: true,
			data: { owner: 'octocat', repo: 'hello', ref: 'main' },
		});
	});

	it('parses a tree URL with a ref and nested subpath', () => {
		expect(
			parseGithubUrl('https://github.com/octocat/hello/tree/v1.2.0/.claude/skills/implement'),
		).toEqual({
			success: true,
			data: { owner: 'octocat', repo: 'hello', ref: 'v1.2.0', subpath: '.claude/skills/implement' },
		});
	});
});

describe('parseGithubUrl rejects', () => {
	const rejects = [
		['not a URL at all', 'octocat/hello'],
		['a non-github host', 'https://gitlab.com/octocat/hello'],
		['plain http', 'http://github.com/octocat/hello'],
		['a missing repo', 'https://github.com/octocat'],
		['a blob URL', 'https://github.com/octocat/hello/blob/main/README.md'],
		['tree with no ref', 'https://github.com/octocat/hello/tree'],
		['a bad owner', 'https://github.com/-octocat-/hello'],
		['a malformed escape', 'https://github.com/octocat/hello/tree/main/%E0%A4%A'],
	] as const;

	it.each(rejects)('rejects %s', (_label, input) => {
		const result = parseGithubUrl(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.code).toBe('bad-url');
		}
	});

	it('never lets ".." reach the subpath (URL normalization collapses it)', () => {
		const result = parseGithubUrl('https://github.com/octocat/hello/tree/main/../secrets');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ owner: 'octocat', repo: 'hello', ref: 'secrets' });
		}
	});
});
