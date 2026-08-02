import { and, desc, eq } from 'drizzle-orm';
import type { AdminAbuseReport, MaintainerReport } from 'skill-schema';
import type { Db } from './client';
import { abuseReports, skills, users, type AbuseReportRow } from './schema';

export async function createAbuseReport(
	db: Db,
	values: { skillId: number; reporterId: number; reason: string },
): Promise<AbuseReportRow> {
	const [row] = await db.insert(abuseReports).values(values).returning();
	return row;
}

export async function findOpenReportBySkillAndReporter(
	db: Db,
	skillId: number,
	reporterId: number,
): Promise<AbuseReportRow | undefined> {
	const [row] = await db
		.select()
		.from(abuseReports)
		.where(
			and(
				eq(abuseReports.skillId, skillId),
				eq(abuseReports.reporterId, reporterId),
				eq(abuseReports.status, 'open'),
			),
		);
	return row;
}

// An open report joined with the skill it targets and the reporter - the admin
// queue's per-row context.
export interface AdminAbuseReportRecord {
	report: AbuseReportRow;
	skill: { slug: string; name: string };
	reporter: { username: string };
}

export async function listOpenAbuseReports(db: Db): Promise<AdminAbuseReportRecord[]> {
	return db
		.select({
			report: abuseReports,
			skill: { slug: skills.slug, name: skills.name },
			reporter: { username: users.username },
		})
		.from(abuseReports)
		.innerJoin(skills, eq(abuseReports.skillId, skills.id))
		.innerJoin(users, eq(abuseReports.reporterId, users.id))
		.where(eq(abuseReports.status, 'open'))
		.orderBy(desc(abuseReports.createdAt), desc(abuseReports.id));
}

// Reports filed against a maintainer's skills. The reporter is deliberately
// not selected - maintainers never see who filed.
export interface MaintainerReportRecord {
	report: AbuseReportRow;
	skill: { slug: string; name: string };
}

export async function listReportsAgainstMaintainer(
	db: Db,
	maintainerId: number,
): Promise<MaintainerReportRecord[]> {
	return db
		.select({ report: abuseReports, skill: { slug: skills.slug, name: skills.name } })
		.from(abuseReports)
		.innerJoin(skills, eq(abuseReports.skillId, skills.id))
		.where(eq(skills.maintainerId, maintainerId))
		.orderBy(desc(abuseReports.createdAt), desc(abuseReports.id));
}

export function maintainerReport(r: MaintainerReportRecord): MaintainerReport {
	return {
		id: r.report.id,
		skill: { slug: r.skill.slug, name: r.skill.name },
		reason: r.report.reason,
		status: r.report.status,
		createdAt: r.report.createdAt.toISOString(),
	};
}

export function adminAbuseReport(r: AdminAbuseReportRecord): AdminAbuseReport {
	return {
		id: r.report.id,
		reason: r.report.reason,
		status: r.report.status,
		createdAt: r.report.createdAt.toISOString(),
		skill: { slug: r.skill.slug, name: r.skill.name },
		reporter: { username: r.reporter.username },
	};
}

// A single report with the same joins as the queue, plus the skill's
// maintainerId so resolve can dock the right account. maintainerId is dropped
// by adminAbuseReport, so this stays passable to it.
export interface AdminAbuseReportDetail extends AdminAbuseReportRecord {
	skill: { slug: string; name: string; maintainerId: number };
}

export async function findAdminReportById(
	db: Db,
	id: number,
): Promise<AdminAbuseReportDetail | undefined> {
	const [row] = await db
		.select({
			report: abuseReports,
			skill: { slug: skills.slug, name: skills.name, maintainerId: skills.maintainerId },
			reporter: { username: users.username },
		})
		.from(abuseReports)
		.innerJoin(skills, eq(abuseReports.skillId, skills.id))
		.innerJoin(users, eq(abuseReports.reporterId, users.id))
		.where(eq(abuseReports.id, id));
	return row;
}

export async function setAbuseReportStatus(
	db: Db,
	id: number,
	status: AbuseReportRow['status'],
): Promise<void> {
	await db.update(abuseReports).set({ status }).where(eq(abuseReports.id, id));
}
