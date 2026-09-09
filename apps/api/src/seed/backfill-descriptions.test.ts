import { describe, expect, it } from 'vitest';
import { isBrokenSummary } from './backfill-descriptions';

describe('isBrokenSummary', () => {
	it.each([
		'>',
		'>-',
		'>+',
		'|',
		'|-',
		'|+',
		'',
		'  ',
		'ab',
		'<p align="center">',
		'Intro <a href="x">link</a> text',
		'> A repeatable editorial system for people who want AI help',
		'You provide two short planning docs. The AI turns them into project context,',
		'Use when asked to:',
	])('flags %j as broken', (s) => {
		expect(isBrokenSummary(s)).toBe(true);
	});

	it.each([null, undefined])('flags %j as broken', (s) => {
		expect(isBrokenSummary(s)).toBe(true);
	});

	it.each([
		'A real one-line description.',
		'Guides the design of workflow-based skills with multi-step phases.',
		'>>> a real sentence that merely starts with angle brackets',
	])('keeps %j', (s) => {
		expect(isBrokenSummary(s)).toBe(false);
	});
});
