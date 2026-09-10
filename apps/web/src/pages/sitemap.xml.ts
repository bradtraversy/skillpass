import type { APIRoute } from 'astro';
import { getSkills } from '../lib/api';
import { buildSitemap } from '../lib/sitemap';

// Rendered on demand so new publishes appear without a rebuild; degrades to
// the static routes when the API is unreachable.
export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
	const result = await getSkills({ signal: AbortSignal.timeout(4000) });
	const slugs = result.success ? result.data.map((skill) => skill.slug) : [];
	return new Response(buildSitemap(String(site ?? 'https://skillpass.dev'), slugs), {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			// Crawlers re-fetch often; an hour of staleness is fine for new publishes.
			'Cache-Control': 'public, max-age=3600',
		},
	});
};
