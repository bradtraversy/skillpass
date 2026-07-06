import { integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { SUBMISSION_SOURCE_TYPES, SUBMISSION_STATUSES } from 'skill-schema';

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
