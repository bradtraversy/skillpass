import type {
	CategorySlug,
	IntegrationSlug,
	PublicSkillSummary,
	Target,
	ValidationStatus,
} from 'skill-schema';

export type DirectoryTab = 'featured' | 'new' | 'verified';
export type TypeFilter = 'all' | 'skill' | 'pack';
export type CategoryFilter = CategorySlug | 'all' | 'uncategorized';
export type IntegrationFilter = IntegrationSlug | 'all';

export interface SkillFilters {
	query: string;
	verdict: ValidationStatus | 'all';
	tool: Target | 'all';
	category: CategoryFilter;
	integration: IntegrationFilter;
	type: TypeFilter;
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
		if (filters.category !== 'all') {
			// The field is optional in the payload schema, so normalize absent to null.
			const category = skill.category ?? null;
			if (filters.category === 'uncategorized' ? category !== null : category !== filters.category)
				return false;
		}
		if (filters.integration !== 'all' && !(skill.integrations ?? []).includes(filters.integration))
			return false;
		const isPack = (skill.packSkills?.length ?? 0) > 0;
		if (filters.type === 'pack' && !isPack) return false;
		if (filters.type === 'skill' && isPack) return false;
		if (!query) return true;

		const haystack = [
			skill.name,
			skill.summary,
			skill.maintainer,
			...skill.targets,
			...(skill.packSkills ?? []),
		]
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
	// Default view: curated picks lead, newest-first within each group.
	return [...newest.filter((s) => s.featured), ...newest.filter((s) => !s.featured)];
}
