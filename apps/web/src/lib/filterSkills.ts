import type { PublicSkillSummary, Target, ValidationStatus } from 'skill-schema';

export interface SkillFilters {
	query: string;
	verdict: ValidationStatus | 'all';
	tool: Target | 'all';
}

// Pure, client-side directory filter. Search matches name, summary, maintainer,
// and target tools (the "skills, tools, or maintainers" promise).
export function filterSkills(
	skills: PublicSkillSummary[],
	filters: SkillFilters,
): PublicSkillSummary[] {
	const query = filters.query.trim().toLowerCase();

	return skills.filter((skill) => {
		if (filters.verdict !== 'all' && skill.validationStatus !== filters.verdict) return false;
		if (filters.tool !== 'all' && !skill.targets.includes(filters.tool)) return false;
		if (!query) return true;

		const haystack = [skill.name, skill.summary, skill.maintainer, ...skill.targets]
			.join(' ')
			.toLowerCase();

		return haystack.includes(query);
	});
}
