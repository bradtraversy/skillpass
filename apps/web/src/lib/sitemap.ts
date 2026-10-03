import { INSTALL_TOOLS } from './install-tools';

export const STATIC_ROUTES = [
	'/',
	'/submit',
	'/docs',
	'/docs/validation',
	'/docs/submitting',
	'/docs/cli',
	'/docs/api',
	'/official',
	'/install',
	...INSTALL_TOOLS.map((tool) => `/install/${tool.slug}`),
];

const XML_ESCAPES: Record<string, string> = {
	'<': '&lt;',
	'>': '&gt;',
	'&': '&amp;',
	"'": '&apos;',
	'"': '&quot;',
};

function escapeXml(value: string): string {
	return value.replace(/[<>&'"]/g, (c) => XML_ESCAPES[c]);
}

export function buildSitemap(site: string, skillSlugs: string[], ownerLogins: string[] = []): string {
	const base = site.replace(/\/$/, '');
	const paths = [
		...STATIC_ROUTES,
		...skillSlugs.map((slug) => `/skills/${encodeURIComponent(slug)}`),
		...ownerLogins.map((login) => `/by/${encodeURIComponent(login)}`),
	];
	const urls = paths.map((path) => `  <url><loc>${escapeXml(`${base}${path}`)}</loc></url>`).join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
