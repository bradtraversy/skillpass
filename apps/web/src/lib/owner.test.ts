import type { PublicSkillSummary } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { ownerLogins, skillsByOwner } from './owner';

function summary(overrides: Partial<PublicSkillSummary>): PublicSkillSummary {
	return {
		slug: 'skill',
		name: 'Skill',
		summary: 'Does things.',
		targets: ['claude-code'],
		validationStatus: 'passed',
		riskLevel: 'low',
		version: '1.0.0',
		maintainer: 'someone',
		attributedTo: null,
		featured: false,
		verified: true,
		publishedAt: '2026-07-07T18:00:00.000Z',
		...overrides,
	};
}

const sample = [
	summary({ slug: 'pdf', name: 'pdf', displayName: 'PDF', attributedTo: 'anthropics' }),
	summary({ slug: 'tdd', name: 'tdd', attributedTo: 'mattpocock' }),
	summary({ slug: 'docx', name: 'docx', attributedTo: 'anthropics' }),
	summary({ slug: 'my-skill', name: 'my-skill', attributedTo: null, maintainer: 'bradtraversy' }),
	summary({ slug: 'azure-functions', name: 'azure-functions', attributedTo: 'MicrosoftDocs' }),
];

describe('skillsByOwner', () => {
	it('lists the skills attributed to an owner, sorted by display title', () => {
		const page = skillsByOwner(sample, 'anthropics');
		expect(page?.skills.map((skill) => skill.slug)).toEqual(['docx', 'pdf']);
	});

	it('names an official owner and keeps its canonical login', () => {
		expect(skillsByOwner(sample, 'ANTHROPICS')).toMatchObject({ login: 'anthropics', name: 'Anthropic' });
		expect(skillsByOwner(sample, 'microsoftdocs')).toMatchObject({ login: 'MicrosoftDocs', name: 'Microsoft Docs' });
	});

	it('keeps the recorded casing and no name for a non-official owner', () => {
		expect(skillsByOwner(sample, 'MattPocock')).toMatchObject({ login: 'mattpocock', name: null });
	});

	it('falls back to the maintainer when nothing is attributed', () => {
		expect(skillsByOwner(sample, 'bradtraversy')?.skills.map((skill) => skill.slug)).toEqual(['my-skill']);
	});

	it('does not list other owners or the curator of attributed skills', () => {
		expect(skillsByOwner(sample, 'someone')).toBeNull();
		expect(skillsByOwner(sample, 'nobody-here')).toBeNull();
	});
});

describe('ownerLogins', () => {
	it('returns each owner once, canonical, in first-seen order', () => {
		expect(ownerLogins(sample)).toEqual(['anthropics', 'mattpocock', 'bradtraversy', 'MicrosoftDocs']);
	});

	it('merges case variants of the same owner', () => {
		const skills = [
			summary({ slug: 'a', attributedTo: 'microsoftdocs' }),
			summary({ slug: 'b', attributedTo: 'MicrosoftDocs' }),
			summary({ slug: 'c', attributedTo: 'Obra' }),
			summary({ slug: 'd', attributedTo: 'obra' }),
		];
		expect(ownerLogins(skills)).toEqual(['MicrosoftDocs', 'Obra']);
	});

	it('is empty for no skills', () => {
		expect(ownerLogins([])).toEqual([]);
	});
});
