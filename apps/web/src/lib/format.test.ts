import { describe, expect, it } from 'vitest';
import { formatInstalls, monogram } from './format';

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

describe('formatInstalls', () => {
	it('abbreviates thousands with one decimal', () => {
		expect(formatInstalls(5900)).toBe('5.9k');
		expect(formatInstalls(1000)).toBe('1.0k');
	});

	it('leaves counts under 1000 as-is', () => {
		expect(formatInstalls(870)).toBe('870');
		expect(formatInstalls(640)).toBe('640');
	});

	it('renders zero or negative as held', () => {
		expect(formatInstalls(0)).toBe('held');
		expect(formatInstalls(-5)).toBe('held');
	});
});
