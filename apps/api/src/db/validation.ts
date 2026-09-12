import { desc, eq } from 'drizzle-orm';
import type { Db } from './client';
import {
	validationJobs,
	validationReports,
	type ProgressStep,
	type ValidationJobRow,
	type ValidationReportRow,
} from './schema';

export async function createValidationJob(db: Db, submissionId: number): Promise<ValidationJobRow> {
	const [row] = await db.insert(validationJobs).values({ submissionId }).returning();
	return row;
}

export async function setValidationJobBullId(db: Db, id: number, bullJobId: string): Promise<void> {
	await db.update(validationJobs).set({ bullJobId }).where(eq(validationJobs.id, id));
}

export async function markValidationJobError(db: Db, id: number, error: string): Promise<void> {
	await db
		.update(validationJobs)
		.set({ state: 'error', error, finishedAt: new Date() })
		.where(eq(validationJobs.id, id));
}

export async function findValidationJobForSubmission(
	db: Db,
	submissionId: number,
): Promise<ValidationJobRow | undefined> {
	const [row] = await db
		.select()
		.from(validationJobs)
		.where(eq(validationJobs.submissionId, submissionId))
		.orderBy(desc(validationJobs.id))
		.limit(1);
	return row;
}

// Progress rows reset on every attempt so retries never show stale states.
export async function markValidationJobRunning(db: Db, id: number, progress: ProgressStep[]): Promise<void> {
	await db
		.update(validationJobs)
		.set({ state: 'running', progress, error: null, startedAt: new Date(), finishedAt: null })
		.where(eq(validationJobs.id, id));
}

export async function updateValidationJobProgress(db: Db, id: number, progress: ProgressStep[]): Promise<void> {
	await db.update(validationJobs).set({ progress }).where(eq(validationJobs.id, id));
}

export async function markValidationJobDone(db: Db, id: number, progress: ProgressStep[]): Promise<void> {
	await db
		.update(validationJobs)
		.set({ state: 'done', progress, finishedAt: new Date() })
		.where(eq(validationJobs.id, id));
}

export async function findValidationReportForSubmission(
	db: Db,
	submissionId: number,
): Promise<ValidationReportRow | undefined> {
	const [row] = await db.select().from(validationReports).where(eq(validationReports.submissionId, submissionId));
	return row;
}

export type NewValidationReport = typeof validationReports.$inferInsert;

// One report per submission: retries replace instead of duplicating.
export async function upsertValidationReport(db: Db, values: NewValidationReport): Promise<ValidationReportRow> {
	const [row] = await db
		.insert(validationReports)
		.values(values)
		.onConflictDoUpdate({
			target: validationReports.submissionId,
			set: {
				status: values.status,
				riskLevel: values.riskLevel,
				sourceHash: values.sourceHash,
				engineVersion: values.engineVersion,
				report: values.report,
				createdAt: new Date(),
			},
		})
		.returning();
	return row;
}
