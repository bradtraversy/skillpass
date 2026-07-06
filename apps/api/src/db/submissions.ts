import { and, desc, eq } from 'drizzle-orm';
import type { Db } from './client';
import { submissions, type SubmissionRow } from './schema';

export type NewSubmission = typeof submissions.$inferInsert;

// The locked API shape 5c's island consumes; snapshotKey and userId stay internal.
export interface PublicSubmission {
	id: number;
	sourceType: SubmissionRow['sourceType'];
	githubUrl: string | null;
	status: SubmissionRow['status'];
	resolvedCommitSha: string | null;
	sourceHash: string;
	createdAt: string;
}

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

// Both reads scope by userId in the query itself, so another user's id and a
// nonexistent id are the same 404 - no existence leak.
export async function listSubmissionsForUser(db: Db, userId: number): Promise<SubmissionRow[]> {
	return db
		.select()
		.from(submissions)
		.where(eq(submissions.userId, userId))
		.orderBy(desc(submissions.createdAt), desc(submissions.id));
}

export async function findSubmissionForUser(
	db: Db,
	userId: number,
	id: number,
): Promise<SubmissionRow | undefined> {
	const [row] = await db
		.select()
		.from(submissions)
		.where(and(eq(submissions.id, id), eq(submissions.userId, userId)));
	return row;
}
