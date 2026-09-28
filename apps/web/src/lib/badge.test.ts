import { describe, expect, it } from 'vitest';
import { API_URL } from './api';
import { SITE_URL, badgeMarkdown, badgeUrl } from './badge';

describe('badgeUrl', () => {
	it('points at the API badge route for the slug', () => {
		expect(badgeUrl('pdf')).toBe(`${API_URL}/skills/pdf/badge.svg`);
	});

	it('encodes a slug that needs it', () => {
		expect(badgeUrl('a b/c')).toBe(`${API_URL}/skills/a%20b%2Fc/badge.svg`);
	});
});

describe('badgeMarkdown', () => {
	it('wraps the badge image in a link to the public skill page', () => {
		expect(badgeMarkdown('pdf')).toBe(`[![SkillPass](${API_URL}/skills/pdf/badge.svg)](${SITE_URL}/skills/pdf)`);
	});

	it('encodes the slug in both URLs', () => {
		expect(badgeMarkdown('a b')).toBe(`[![SkillPass](${API_URL}/skills/a%20b/badge.svg)](${SITE_URL}/skills/a%20b)`);
	});

	it('falls back to the public site with no trailing slash', () => {
		expect(SITE_URL).toBe('https://skillpass.dev');
	});
});
