import { describe, expect, it } from 'vitest';
import { SITE_URL } from './site';

describe('SITE_URL', () => {
	it('falls back to the public site with no trailing slash', () => {
		expect(SITE_URL).toBe('https://skillpass.dev');
	});
});
