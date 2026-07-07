import { desc, eq } from 'drizzle-orm';
import type { Db } from './client';
import {
	skillPassports,
	skills,
	skillVersions,
	type SkillPassportRow,
	type SkillRow,
	type SkillVersionRow,
} from './schema';

export type NewSkill = typeof skills.$inferInsert;
export type NewSkillVersion = typeof skillVersions.$inferInsert;
export type NewSkillPassport = typeof skillPassports.$inferInsert;

export async function findSkillBySlug(db: Db, slug: string): Promise<SkillRow | undefined> {
	const [row] = await db.select().from(skills).where(eq(skills.slug, slug));
	return row;
}

export async function findVersionBySubmission(
	db: Db,
	submissionId: number,
): Promise<SkillVersionRow | undefined> {
	const [row] = await db
		.select()
		.from(skillVersions)
		.where(eq(skillVersions.submissionId, submissionId));
	return row;
}

// Latest by insert order, not skills.latestVersionId, so a publish that crashed
// before setLatestVersion still bumps from the newest inserted version.
export async function findLatestVersionForSkill(
	db: Db,
	skillId: number,
): Promise<SkillVersionRow | undefined> {
	const [row] = await db
		.select()
		.from(skillVersions)
		.where(eq(skillVersions.skillId, skillId))
		.orderBy(desc(skillVersions.id))
		.limit(1);
	return row;
}

export async function createSkill(db: Db, values: NewSkill): Promise<SkillRow> {
	const [row] = await db.insert(skills).values(values).returning();
	return row;
}

export async function createSkillVersion(
	db: Db,
	values: NewSkillVersion,
): Promise<SkillVersionRow> {
	const [row] = await db.insert(skillVersions).values(values).returning();
	return row;
}

export async function createSkillPassport(
	db: Db,
	values: NewSkillPassport,
): Promise<SkillPassportRow> {
	const [row] = await db.insert(skillPassports).values(values).returning();
	return row;
}

export async function setLatestVersion(
	db: Db,
	skillId: number,
	versionId: number,
	now: Date = new Date(),
): Promise<void> {
	await db
		.update(skills)
		.set({ latestVersionId: versionId, updatedAt: now })
		.where(eq(skills.id, skillId));
}
