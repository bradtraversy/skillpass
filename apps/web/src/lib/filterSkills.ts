import type { Skill, Target, Verdict } from './skills';

export interface SkillFilters {
	query: string;
	verdict: Verdict | 'all';
	tool: Target | 'all';
}

// Pure, client-side directory filter. Search matches name, summary, maintainer,
// category, tags, and target tools (the "skills, tools, or maintainers" promise).
export function filterSkills(skills: Skill[], filters: SkillFilters): Skill[] {
	const query = filters.query.trim().toLowerCase();

	return skills.filter((skill) => {
		if (filters.verdict !== 'all' && skill.verdict !== filters.verdict) return false;
		if (filters.tool !== 'all' && !skill.targets.includes(filters.tool)) return false;
		if (!query) return true;

		const haystack = [
			skill.name,
			skill.summary,
			skill.maintainer,
			skill.category,
			...skill.tags,
			...skill.targets,
		]
			.join(' ')
			.toLowerCase();

		return haystack.includes(query);
	});
}
