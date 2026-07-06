import { integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import {
	RISK_LEVELS,
	SUBMISSION_SOURCE_TYPES,
	SUBMISSION_STATUSES,
	VALIDATION_STATUSES,
	type ValidationReport,
} from 'skill-schema';

export const userRole = pgEnum('user_role', ['user', 'maintainer', 'admin']);

export const users = pgTable('users', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	githubId: text('github_id').notNull().unique(),
	username: text('username').notNull().unique(),
	displayName: text('display_name').notNull(),
	avatarUrl: text('avatar_url').notNull(),
	role: userRole('role').notNull().default('maintainer'),
	reputation: integer('reputation').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;

export const sourceType = pgEnum('source_type', SUBMISSION_SOURCE_TYPES);
export const submissionStatus = pgEnum('submission_status', SUBMISSION_STATUSES);

// resolvedCommitSha and githubUrl are null for zip submissions (feature 5c);
// sourceHash/snapshotKey are always set - a row exists only after a snapshot does.
export const submissions = pgTable('submissions', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id),
	sourceType: sourceType('source_type').notNull(),
	githubUrl: text('github_url'),
	uploadedZipKey: text('uploaded_zip_key'),
	status: submissionStatus('status').notNull().default('draft'),
	resolvedCommitSha: text('resolved_commit_sha'),
	sourceHash: text('source_hash').notNull(),
	snapshotKey: text('snapshot_key').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SubmissionRow = typeof submissions.$inferSelect;

export const VALIDATION_JOB_STATES = ['queued', 'running', 'done', 'error'] as const;
export type ValidationJobState = (typeof VALIDATION_JOB_STATES)[number];

export const PROGRESS_STEP_STATES = ['pending', 'running', 'ok', 'warn', 'fail'] as const;
export type ProgressStepState = (typeof PROGRESS_STEP_STATES)[number];

// 6b renders these rows in the /submit progress panel.
export interface ProgressStep {
	key: string;
	label: string;
	state: ProgressStepState;
}

export const validationJobState = pgEnum('validation_job_state', VALIDATION_JOB_STATES);

export const validationJobs = pgTable('validation_jobs', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	submissionId: integer('submission_id')
		.notNull()
		.references(() => submissions.id),
	state: validationJobState('state').notNull().default('queued'),
	progress: jsonb('progress').$type<ProgressStep[]>().notNull().default([]),
	bullJobId: text('bull_job_id'),
	error: text('error'),
	startedAt: timestamp('started_at', { withTimezone: true }),
	finishedAt: timestamp('finished_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ValidationJobRow = typeof validationJobs.$inferSelect;

export const validationStatus = pgEnum('validation_status', VALIDATION_STATUSES);
export const riskLevel = pgEnum('risk_level', RISK_LEVELS);

// submissionId is unique so worker retries upsert one report per submission.
export const validationReports = pgTable('validation_reports', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	submissionId: integer('submission_id')
		.notNull()
		.unique()
		.references(() => submissions.id),
	status: validationStatus('status').notNull(),
	riskLevel: riskLevel('risk_level').notNull(),
	sourceHash: text('source_hash').notNull(),
	engineVersion: text('engine_version').notNull(),
	report: jsonb('report').$type<ValidationReport>().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ValidationReportRow = typeof validationReports.$inferSelect;
