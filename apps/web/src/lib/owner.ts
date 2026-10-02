import type { PublicSkillSummary } from 'skill-schema';
import { OFFICIAL_OWNERS } from './official';

export interface OwnerPage {
	login: string;
	name: string | null;
	skills: PublicSkillSummary[];
}

// Same owner expression as the row's "by" line and the Official page.
const ownerOf = (skill: PublicSkillSummary) => skill.attributedTo ?? skill.maintainer;
const title = (skill: PublicSkillSummary) => skill.displayName ?? skill.name;

function officialFor(login: string) {
	const key = login.toLowerCase();
	return OFFICIAL_OWNERS.find((owner) => owner.login.toLowerCase() === key);
}

export function skillsByOwner(skills: readonly PublicSkillSummary[], login: string): OwnerPage | null {
	const key = login.toLowerCase();
	const matches = skills.filter((skill) => ownerOf(skill).toLowerCase() === key);
	const first = matches[0];
	if (!first) return null;
	const official = officialFor(key);
	return {
		login: official?.login ?? ownerOf(first),
		name: official?.name ?? null,
		skills: matches.sort((a, b) => title(a).localeCompare(title(b), 'en', { sensitivity: 'base' })),
	};
}

export function ownerLogins(skills: readonly PublicSkillSummary[]): string[] {
	const seen = new Map<string, string>();
	for (const skill of skills) {
		const recorded = ownerOf(skill);
		const key = recorded.toLowerCase();
		if (!seen.has(key)) seen.set(key, officialFor(key)?.login ?? recorded);
	}
	return [...seen.values()];
}
