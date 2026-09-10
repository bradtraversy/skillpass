import type { PublicSkillSummary, Target } from 'skill-schema';

export interface FacetCounts {
	// Category slug, or "uncategorized" for a listing not yet classified.
	categories: Map<string, number>;
	integrations: Map<string, number>;
	tools: Target[];
	packs: number;
}

// Sidebar counts always come from the full unfiltered list so they never
// shrink as filters narrow the results.
export function facetCounts(skills: PublicSkillSummary[]): FacetCounts {
	const categories = new Map<string, number>();
	const integrations = new Map<string, number>();
	let packs = 0;
	for (const skill of skills) {
		const key = skill.category ?? 'uncategorized';
		categories.set(key, (categories.get(key) ?? 0) + 1);
		for (const slug of skill.integrations ?? []) {
			integrations.set(slug, (integrations.get(slug) ?? 0) + 1);
		}
		if ((skill.packSkills?.length ?? 0) > 0) packs++;
	}
	const tools = Array.from(new Set(skills.flatMap((s) => s.targets))).sort();
	return { categories, integrations, tools, packs };
}
