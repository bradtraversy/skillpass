import { and, desc, eq } from 'drizzle-orm';
import type {
	AdminSkillRef,
	AdminVersionHistory,
	AiReview,
	CategorySlug,
	IntegrationSlug,
	MaintainerSkill,
	PublicSkillDetail,
	PublicSkillSummary,
} from 'skill-schema';
import type { Db } from './client';
import {
	skillPassports,
	skills,
	skillVersions,
	submissions,
	users,
	validationReports,
	type SkillPassportRow,
	type SkillRow,
	type SkillVersionRow,
	type UserRow,
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

// A published skill joined with its latest version, that version's passport,
// and the maintainer - one record per directory entry.
export interface PublishedSkillRecord {
	skill: SkillRow;
	version: SkillVersionRow;
	passport: SkillPassportRow;
	maintainer: UserRow;
}

export async function listPublishedSkills(db: Db): Promise<PublishedSkillRecord[]> {
	return db
		.select({ skill: skills, version: skillVersions, passport: skillPassports, maintainer: users })
		.from(skills)
		.innerJoin(skillVersions, eq(skills.latestVersionId, skillVersions.id))
		.innerJoin(skillPassports, eq(skillPassports.skillVersionId, skillVersions.id))
		.innerJoin(users, eq(skills.maintainerId, users.id))
		.where(eq(skills.status, 'published'))
		.orderBy(desc(skillVersions.publishedAt), desc(skills.id));
}

export async function listPublishedSkillsByMaintainer(
	db: Db,
	maintainerId: number,
): Promise<PublishedSkillRecord[]> {
	return db
		.select({ skill: skills, version: skillVersions, passport: skillPassports, maintainer: users })
		.from(skills)
		.innerJoin(skillVersions, eq(skills.latestVersionId, skillVersions.id))
		.innerJoin(skillPassports, eq(skillPassports.skillVersionId, skillVersions.id))
		.innerJoin(users, eq(skills.maintainerId, users.id))
		.where(and(eq(skills.status, 'published'), eq(skills.maintainerId, maintainerId)))
		.orderBy(desc(skillVersions.publishedAt), desc(skills.id));
}

// Every skill a maintainer owns, any status; left joins so a row whose latest
// version or passport is missing still shows on the dashboard.
export interface MaintainerSkillRecord {
	skill: SkillRow;
	version: SkillVersionRow | null;
	passport: SkillPassportRow | null;
}

export async function listSkillsByMaintainer(
	db: Db,
	maintainerId: number,
): Promise<MaintainerSkillRecord[]> {
	return db
		.select({ skill: skills, version: skillVersions, passport: skillPassports })
		.from(skills)
		.leftJoin(skillVersions, eq(skills.latestVersionId, skillVersions.id))
		.leftJoin(skillPassports, eq(skillPassports.skillVersionId, skillVersions.id))
		.where(eq(skills.maintainerId, maintainerId))
		.orderBy(desc(skills.updatedAt), desc(skills.id));
}

export function maintainerSkill(r: MaintainerSkillRecord): MaintainerSkill {
	return {
		slug: r.skill.slug,
		name: r.skill.displayName ?? r.skill.name,
		status: r.skill.status,
		version: r.version?.version ?? null,
		validationStatus: r.passport?.validationStatus ?? null,
		riskLevel: r.passport?.riskLevel ?? null,
		updatedAt: r.skill.updatedAt.toISOString(),
	};
}

export async function findPublishedSkillBySlug(
	db: Db,
	slug: string,
): Promise<PublishedSkillRecord | undefined> {
	const [row] = await db
		.select({ skill: skills, version: skillVersions, passport: skillPassports, maintainer: users })
		.from(skills)
		.innerJoin(skillVersions, eq(skills.latestVersionId, skillVersions.id))
		.innerJoin(skillPassports, eq(skillPassports.skillVersionId, skillVersions.id))
		.innerJoin(users, eq(skills.maintainerId, users.id))
		.where(and(eq(skills.slug, slug), eq(skills.status, 'published')));
	return row;
}

// Flagged skills for the admin queue, with the maintainer who owns the listing.
export interface FlaggedSkillRecord {
	skill: { slug: string; name: string };
	maintainer: { username: string };
}

export async function listFlaggedSkills(db: Db): Promise<FlaggedSkillRecord[]> {
	return db
		.select({
			skill: { slug: skills.slug, name: skills.name },
			maintainer: { username: users.username },
		})
		.from(skills)
		.innerJoin(users, eq(skills.maintainerId, users.id))
		.where(eq(skills.status, 'flagged'))
		.orderBy(desc(skills.updatedAt), desc(skills.id));
}

export function adminSkillRef(r: FlaggedSkillRecord): AdminSkillRef {
	return { slug: r.skill.slug, name: r.skill.name, maintainer: { username: r.maintainer.username } };
}

export async function setSkillStatus(
	db: Db,
	id: number,
	status: SkillRow['status'],
	now: Date = new Date(),
): Promise<void> {
	await db.update(skills).set({ status, updatedAt: now }).where(eq(skills.id, id));
}

export async function setSkillCuration(
	db: Db,
	id: number,
	patch: { featured?: boolean; verified?: boolean },
	now: Date = new Date(),
): Promise<void> {
	await db
		.update(skills)
		.set({ ...patch, updatedAt: now })
		.where(eq(skills.id, id));
}

// Every version's validation verdict, newest first. A skill_version only exists
// after a passed publish, so its submission always has a report - inner join.
export async function listSkillValidationHistory(
	db: Db,
	skillId: number,
): Promise<AdminVersionHistory[]> {
	const rows = await db
		.select({ version: skillVersions, report: validationReports })
		.from(skillVersions)
		.innerJoin(validationReports, eq(validationReports.submissionId, skillVersions.submissionId))
		.where(eq(skillVersions.skillId, skillId))
		.orderBy(desc(skillVersions.id));
	return rows.map((r) => ({
		version: r.version.version,
		publishedAt: r.version.publishedAt?.toISOString() ?? null,
		validationStatus: r.report.status,
		riskLevel: r.report.riskLevel,
		warnings: r.report.report.warnings,
		failures: r.report.report.failures,
		sourceHash: r.version.sourceHash,
		resolvedCommitSha: r.version.resolvedCommitSha,
	}));
}

export interface VersionWithPassport {
	version: SkillVersionRow;
	passport: SkillPassportRow;
}

export async function findVersionWithPassport(
	db: Db,
	skillId: number,
	version: string,
): Promise<VersionWithPassport | undefined> {
	const [row] = await db
		.select({ version: skillVersions, passport: skillPassports })
		.from(skillVersions)
		.innerJoin(skillPassports, eq(skillPassports.skillVersionId, skillVersions.id))
		.where(and(eq(skillVersions.skillId, skillId), eq(skillVersions.version, version)));
	return row;
}

export async function listVersionsWithPassports(
	db: Db,
	skillId: number,
): Promise<VersionWithPassport[]> {
	return db
		.select({ version: skillVersions, passport: skillPassports })
		.from(skillVersions)
		.innerJoin(skillPassports, eq(skillPassports.skillVersionId, skillVersions.id))
		.where(eq(skillVersions.skillId, skillId))
		.orderBy(desc(skillVersions.id));
}

export function publicSkillSummary(r: PublishedSkillRecord): PublicSkillSummary {
	return {
		slug: r.skill.slug,
		name: r.skill.name,
		summary: r.skill.summary,
		targets: r.version.targets,
		validationStatus: r.passport.validationStatus,
		riskLevel: r.passport.riskLevel,
		noteCount: r.passport.passport.warningsSummary.length,
		category: r.skill.category,
		displayName: r.skill.displayName,
		tagline: r.skill.tagline,
		integrations: r.skill.integrations,
		packSkills: r.version.packSkills?.map((s) => s.name) ?? null,
		version: r.version.version,
		maintainer: r.maintainer.username,
		attributedTo: r.skill.attributedTo,
		featured: r.skill.featured,
		verified: r.skill.verified,
		publishedAt: (r.version.publishedAt ?? r.version.createdAt).toISOString(),
	};
}

export function publicSkillDetail(
	r: PublishedSkillRecord,
	versions: VersionWithPassport[],
	aiReview: AiReview | null = null,
): PublicSkillDetail {
	return {
		...publicSkillSummary(r),
		packMembers: r.version.packSkills ?? null,
		githubRepoUrl: r.version.githubRepoUrl,
		passport: r.passport.passport,
		maintainerInfo: {
			username: r.maintainer.username,
			displayName: r.maintainer.displayName,
			avatarUrl: r.maintainer.avatarUrl,
		},
		versions: versions.map((v) => ({
			version: v.version.version,
			validationStatus: v.passport.validationStatus,
			riskLevel: v.passport.riskLevel,
			publishedAt: (v.version.publishedAt ?? v.version.createdAt).toISOString(),
		})),
		aiReview,
	};
}

// Also refreshes the listing copy so the directory always describes the
// latest published version.
export async function setLatestVersion(
	db: Db,
	skillId: number,
	versionId: number,
	listing: { name: string; summary: string },
	now: Date = new Date(),
): Promise<void> {
	await db
		.update(skills)
		.set({ latestVersionId: versionId, name: listing.name, summary: listing.summary, updatedAt: now })
		.where(eq(skills.id, skillId));
}

export async function setSkillCategory(
	db: Db,
	skillId: number,
	category: CategorySlug,
): Promise<void> {
	await db.update(skills).set({ category }).where(eq(skills.id, skillId));
}

export async function setSkillDisplayCopy(
	db: Db,
	skillId: number,
	copy: { displayName: string; tagline: string },
): Promise<void> {
	await db.update(skills).set(copy).where(eq(skills.id, skillId));
}

export async function setSkillIntegrations(
	db: Db,
	skillId: number,
	integrations: IntegrationSlug[],
): Promise<void> {
	await db.update(skills).set({ integrations }).where(eq(skills.id, skillId));
}
