import type { PublicSkillSummary, Target, ValidationStatus } from 'skill-schema';

export type DirectoryTab = 'featured' | 'new' | 'verified';

export interface SkillFilters {
	query: string;
	verdict: ValidationStatus | 'all';
	tool: Target | 'all';
	tab: DirectoryTab;
}

// Newest first; publishedAt is an ISO string, so lexical order is chronological.
function byNewest(a: PublicSkillSummary, b: PublicSkillSummary): number {
	return a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0;
}

// Pure, client-side directory filter. Text search matches name, summary,
// maintainer, and target tools; the tab then filters and sorts the matches.
export function filterSkills(
	skills: PublicSkillSummary[],
	filters: SkillFilters,
): PublicSkillSummary[] {
	const query = filters.query.trim().toLowerCase();

	const matched = skills.filter((skill) => {
		if (filters.verdict !== 'all' && skill.validationStatus !== filters.verdict) return false;
		if (filters.tool !== 'all' && !skill.targets.includes(filters.tool)) return false;
		if (!query) return true;

		const haystack = [skill.name, skill.summary, skill.maintainer, ...skill.targets]
			.join(' ')
			.toLowerCase();

		return haystack.includes(query);
	});

	const newest = [...matched].sort(byNewest);

	if (filters.tab === 'verified') {
		return newest.filter((s) => s.verified);
	}
	if (filters.tab === 'featured') {
		const featured = newest.filter((s) => s.featured);
		// Before anything is curated, keep the default tab from going empty.
		return featured.length > 0 ? featured : newest;
	}
	return newest;
}
