import { describe, expect, it } from 'vitest';
import { metaDescription } from './seo';

describe('metaDescription', () => {
	it('returns short text unchanged', () => {
		expect(metaDescription('A tidy summary.')).toBe('A tidy summary.');
	});

	it('collapses whitespace and trims', () => {
		expect(metaDescription('  spaced\n\tout   text  ')).toBe('spaced out text');
	});

	it('truncates long text at a word boundary with a three-dot tail', () => {
		const long = 'word '.repeat(60).trim();
		const out = metaDescription(long);
		expect(out.length).toBeLessThanOrEqual(160);
		expect(out.endsWith('word...')).toBe(true);
		expect(out).not.toMatch(/\s\.\.\.$/);
	});

	it('hard-cuts a single unbroken token', () => {
		const out = metaDescription('x'.repeat(300));
		expect(out).toBe(`${'x'.repeat(157)}...`);
	});

	it('strips html tags', () => {
		expect(metaDescription('<p align="center">A <b>bold</b> skill</p>')).toBe('A bold skill');
	});

	it('respects a custom max', () => {
		const out = metaDescription('one two three four five', 12);
		expect(out).toBe('one two...');
		expect(out.length).toBeLessThanOrEqual(12);
	});
});
