import { describe, expect, it } from 'vitest';
import { isRepoRef, packageNameFor, parseRepoRef } from './repo';

describe('isRepoRef', () => {
	it('recognizes the short form and URLs, not directory slugs', () => {
		expect(isRepoRef('github:o/r')).toBe(true);
		expect(isRepoRef('https://github.com/o/r')).toBe(true);
		expect(isRepoRef('http://github.com/o/r')).toBe(true);
		expect(isRepoRef('github.com/o/r')).toBe(true);
		expect(isRepoRef('pdf')).toBe(false);
		expect(isRepoRef('pdf@1.0.0')).toBe(false);
		expect(isRepoRef('ai-blueprint')).toBe(false);
	});
});

describe('parseRepoRef', () => {
	it.each([
		['github:o/r', { owner: 'o', repo: 'r' }],
		['github:o/r/a/b', { owner: 'o', repo: 'r', subpath: 'a/b' }],
		['github:o/r@v1', { owner: 'o', repo: 'r', ref: 'v1' }],
		['github:o/r/a/b@main', { owner: 'o', repo: 'r', ref: 'main', subpath: 'a/b' }],
		['github:o/r.git', { owner: 'o', repo: 'r' }],
		['github:o/r/', { owner: 'o', repo: 'r' }],
		['https://github.com/o/r', { owner: 'o', repo: 'r' }],
		['https://github.com/o/r.git', { owner: 'o', repo: 'r' }],
		['https://github.com/o/r/tree/main', { owner: 'o', repo: 'r', ref: 'main' }],
		['https://github.com/o/r/tree/main/a/b', { owner: 'o', repo: 'r', ref: 'main', subpath: 'a/b' }],
		[
			'https://github.com/my-org/my.repo/tree/v1.2.0/skills/x',
			{
				owner: 'my-org',
				repo: 'my.repo',
				ref: 'v1.2.0',
				subpath: 'skills/x',
			},
		],
	])('parses %s', (ref, target) => {
		expect(parseRepoRef(ref)).toEqual({ ok: true, target });
	});

	it.each([
		'github:o',
		'github:o/',
		'github:/r',
		'github:o/r@',
		'github:-bad/r',
		'github:o/r/../x',
		'github:o/r/./x',
		'https://github.com/o',
		'https://github.com/o/r/blob/main/a',
		'https://github.com/o/r/tree',
		'https://github.com/o/r/tree/main/..',
		'http://github.com/o/r',
		'https://gitlab.com/o/r',
		'https://github.com@evil.com/o/r',
		'github.com/o/r',
		'not a url',
	])('refuses %s with the grammar hint', (ref) => {
		const result = parseRepoRef(ref);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toContain(`invalid repository reference "${ref}"`);
			expect(result.message).toMatch(/expected github:|must not contain/);
		}
	});
});

describe('packageNameFor', () => {
	it('uses the last subpath segment, else the repo name', () => {
		expect(packageNameFor({ owner: 'o', repo: 'r' })).toBe('r');
		expect(packageNameFor({ owner: 'o', repo: 'r', subpath: 'skills/pdf' })).toBe('pdf');
	});
});
