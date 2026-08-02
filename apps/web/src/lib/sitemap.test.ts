import { describe, expect, it } from 'vitest';
import { buildSitemap, STATIC_ROUTES } from './sitemap';

describe('buildSitemap', () => {
	it('includes every static route with an empty skill list', () => {
		const xml = buildSitemap('https://skillpass.dev', []);
		for (const route of STATIC_ROUTES) {
			expect(xml).toContain(`<loc>https://skillpass.dev${route}</loc>`);
		}
		expect(xml.match(/<url>/g)).toHaveLength(STATIC_ROUTES.length);
	});

	it('appends a url per skill slug', () => {
		const xml = buildSitemap('https://skillpass.dev', ['alpha', 'beta']);
		expect(xml).toContain('<loc>https://skillpass.dev/skills/alpha</loc>');
		expect(xml).toContain('<loc>https://skillpass.dev/skills/beta</loc>');
		expect(xml.match(/<url>/g)).toHaveLength(STATIC_ROUTES.length + 2);
	});

	it('escapes xml-unsafe characters in slugs', () => {
		const xml = buildSitemap('https://skillpass.dev', ['a&b']);
		expect(xml).toContain('/skills/a%26b</loc>');
		expect(xml).not.toContain('a&b</loc>');
	});

	it('normalizes a trailing slash on the site origin', () => {
		const xml = buildSitemap('https://skillpass.dev/', []);
		expect(xml).toContain('<loc>https://skillpass.dev/</loc>');
		expect(xml).not.toContain('skillpass.dev//');
	});

	it('is a well-formed urlset document', () => {
		const xml = buildSitemap('https://skillpass.dev', ['alpha']);
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
	});
});
