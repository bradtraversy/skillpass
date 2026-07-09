import { and, eq } from 'drizzle-orm';
import type { Db } from './client';
import { abuseReports, type AbuseReportRow } from './schema';

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
