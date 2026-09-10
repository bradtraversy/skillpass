import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from './client';
import { skillEmbeddings, skills } from './schema';
import { joinPublished, PUBLISHED_SELECT } from './skills';

// Renders SQL only; nothing connects.
const db = createDb('postgresql://user:pass@localhost/skillpass_test');

describe('joinPublished', () => {
	it('applies the three joins and the published predicate', () => {
		const { sql, params } = joinPublished(db.select(PUBLISHED_SELECT).from(skills).$dynamic()).toSQL();
		expect(sql).toContain('inner join "skill_versions"');
		expect(sql).toContain('inner join "skill_passports"');
		expect(sql).toContain('inner join "users"');
		expect(sql).toMatch(/"skills"\."status" = \$1/);
		expect(params).toEqual(['published']);
	});

	it('combines an extra condition with the published predicate', () => {
		const { sql, params } = joinPublished(
			db.select(PUBLISHED_SELECT).from(skills).$dynamic(),
			eq(skills.slug, 'demo'),
		).toSQL();
		expect(sql).toMatch(/"skills"\."status" = \$1 and "skills"\."slug" = \$2/);
		expect(params).toEqual(['published', 'demo']);
	});

	it('works from another table that joins to skills first', () => {
		const { sql } = joinPublished(
			db.select(PUBLISHED_SELECT).from(skillEmbeddings).innerJoin(skills, eq(skillEmbeddings.skillId, skills.id)).$dynamic(),
		).toSQL();
		expect(sql).toMatch(/from "skill_embeddings" inner join "skills"/);
		expect(sql).toContain('inner join "skill_passports"');
	});
});
