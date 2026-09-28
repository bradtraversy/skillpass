import { API_URL } from './api';
import { SITE_URL } from './site';

export function badgeUrl(slug: string): string {
	return `${API_URL}/skills/${encodeURIComponent(slug)}/badge.svg`;
}

export function badgeMarkdown(slug: string): string {
	return `[![SkillPass](${badgeUrl(slug)})](${SITE_URL}/skills/${encodeURIComponent(slug)})`;
}
