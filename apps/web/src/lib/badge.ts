import { API_URL } from './api';

// Astro sets SITE from `site` in astro.config.js; the fallback keeps the
// builder testable under Vitest and always points the README link at the
// public site, whatever host the page is served from.
export const SITE_URL: string = (import.meta.env.SITE ?? 'https://skillpass.dev').replace(/\/$/, '');

export function badgeUrl(slug: string): string {
	return `${API_URL}/skills/${encodeURIComponent(slug)}/badge.svg`;
}

export function badgeMarkdown(slug: string): string {
	return `[![SkillPass](${badgeUrl(slug)})](${SITE_URL}/skills/${encodeURIComponent(slug)})`;
}
