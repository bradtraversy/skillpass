// Astro sets SITE from `site` in astro.config.js; the fallback keeps the
// builders testable under Vitest and always points outbound links at the
// public site, whatever host the page is served from.
export const SITE_URL: string = (import.meta.env.SITE ?? 'https://skillpass.dev').replace(/\/$/, '');
