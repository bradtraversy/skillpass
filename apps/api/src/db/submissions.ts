import { and, desc, eq } from 'drizzle-orm';
import type { AdminSubmission, PublicSubmission } from 'skill-schema';
import type { Db } from './client';
import { submissions, users, validationReports, type SubmissionRow, type ValidationReportRow } from './schema';

export type NewSubmission = typeof submissions.$inferInsert;

export function publicSubmission(row: SubmissionRow): PublicSubmission {
	return {
		id: row.id,
		sourceType: row.sourceType,
		githubUrl: row.githubUrl,
		status: row.status,
		resolvedCommitSha: row.resolvedCommitSha,
		sourceHash: row.sourceHash,
		createdAt: row.createdAt.toISOString(),
	};
}

export async function createSubmission(db: Db, values: NewSubmission): Promise<SubmissionRow> {
	const [row] = await db.insert(submissions).values(values).returning();
	return row;
}

// Unscoped read for the validation worker only; user-facing routes must use
// the ForUser variants below.
export async function findSubmissionById(db: Db, id: number): Promise<SubmissionRow | undefined> {
	const [row] = await db.select().from(submissions).where(eq(submissions.id, id));
	return row;
}

export async function setSubmissionStatus(db: Db, id: number, status: SubmissionRow['status']): Promise<void> {
	await db.update(submissions).set({ status }).where(eq(submissions.id, id));
}

// Both reads scope by userId in the query itself, so another user's id and a
// nonexistent id are the same 404 - no existence leak.
export async function listSubmissionsForUser(db: Db, userId: number): Promise<SubmissionRow[]> {
	return db
		.select()
		.from(submissions)
		.where(eq(submissions.userId, userId))
		.orderBy(desc(submissions.createdAt), desc(submissions.id));
}

export async function findSubmissionForUser(db: Db, userId: number, id: number): Promise<SubmissionRow | undefined> {
	const [row] = await db
		.select()
		.from(submissions)
		.where(and(eq(submissions.id, id), eq(submissions.userId, userId)));
	return row;
}

// A failed submission joined with its submitter and validation report - the
// admin queue's triage rows. Unscoped by user: the admin sees every failure.
export interface FailedSubmissionRecord {
	submission: SubmissionRow;
	user: { username: string };
	report: ValidationReportRow | null;
}

export async function listFailedSubmissions(db: Db): Promise<FailedSubmissionRecord[]> {
	const rows = await db
		.select({ submission: submissions, user: { username: users.username }, report: validationReports })
		.from(submissions)
		.innerJoin(users, eq(submissions.userId, users.id))
		.leftJoin(validationReports, eq(validationReports.submissionId, submissions.id))
		.where(eq(submissions.status, 'failed'))
		.orderBy(desc(submissions.createdAt), desc(submissions.id));
	return rows.map((r) => ({ submission: r.submission, user: r.user, report: r.report ?? null }));
}

export function adminSubmission(r: FailedSubmissionRecord): AdminSubmission {
	return {
		id: r.submission.id,
		sourceType: r.submission.sourceType,
		githubUrl: r.submission.githubUrl,
		status: r.submission.status,
		createdAt: r.submission.createdAt.toISOString(),
		user: { username: r.user.username },
		report: r.report
			? {
					status: r.report.status,
					riskLevel: r.report.riskLevel,
					warnings: r.report.report.warnings,
					failures: r.report.report.failures,
				}
			: null,
	};
}
