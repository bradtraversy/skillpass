import {
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	vector,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
	ABUSE_REPORT_STATUSES,
	PROGRESS_STEP_STATES,
	RISK_LEVELS,
	SKILL_STATUSES,
	SOURCE_TYPES,
	SUBMISSION_SOURCE_TYPES,
	SUBMISSION_STATUSES,
	USER_ROLES,
	VALIDATION_JOB_STATES,
	VALIDATION_STATUSES,
	type AiReview,
	type CategorySlug,
	type IntegrationSlug,
	type ProgressStep,
	type SkillEntry,
	type SkillPassport,
	type Target,
	type ValidationReport,
} from 'skill-schema';

export const userRole = pgEnum('user_role', USER_ROLES);

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

// Job/progress enums and the ProgressStep shape live in skill-schema (6b put
// them on the wire); re-exported so API-internal consumers keep one import.
export type { ProgressStep, ProgressStepState, ValidationJobState } from 'skill-schema';

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

export const skillStatus = pgEnum('skill_status', SKILL_STATUSES);
export const versionSourceType = pgEnum('version_source_type', SOURCE_TYPES);

// latestVersionId is set after the version insert (circular with skill_versions);
// attributedTo credits the source repo owner when an admin curates someone else's repo.
export const skills = pgTable('skills', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	summary: text('summary').notNull(),
	maintainerId: integer('maintainer_id')
		.notNull()
		.references(() => users.id),
	attributedTo: text('attributed_to'),
	// Fixed-taxonomy slug from skill-schema CATEGORIES; null until classified.
	category: text('category').$type<CategorySlug>(),
	// Human display copy from generateDisplayCopy; null until generated.
	displayName: text('display_name'),
	tagline: text('tagline'),
	// Works-with facet; null = never classified, [] = classified as none.
	integrations: text('integrations').array().$type<IntegrationSlug[]>(),
	status: skillStatus('status').notNull(),
	featured: boolean('featured').notNull().default(false),
	// Curated position on the Featured tab; null = featured without a pinned spot
	// (e.g. the admin toggle), which sorts after ranked entries.
	featuredRank: integer('featured_rank'),
	verified: boolean('verified').notNull().default(false),
	latestVersionId: integer('latest_version_id').references((): AnyPgColumn => skillVersions.id),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SkillRow = typeof skills.$inferSelect;

// submissionId is unique: a submission publishes at most once, retries 409
// here. (skillId, version) is unique so concurrent re-publishes can't mint
// duplicate version numbers - the loser 409s and retries with the next number.
export const skillVersions = pgTable(
	'skill_versions',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		skillId: integer('skill_id')
			.notNull()
			.references(() => skills.id),
		version: text('version').notNull(),
		sourceType: versionSourceType('source_type').notNull(),
		githubRepoUrl: text('github_repo_url'),
		resolvedCommitSha: text('resolved_commit_sha'),
		sourceHash: text('source_hash').notNull(),
		snapshotKey: text('snapshot_key').notNull(),
		targets: jsonb('targets').$type<Target[]>().notNull().default([]),
		// The manifest's skills[] entries when this version is a multi-skill pack
		// (>= 2 members); null for single skills. Feature 15's CLI reads variants
		// from here for per-target installs.
		packSkills: jsonb('pack_skills').$type<SkillEntry[]>(),
		submissionId: integer('submission_id')
			.notNull()
			.unique()
			.references(() => submissions.id),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [unique('skill_versions_skill_id_version_unique').on(t.skillId, t.version)],
);

export type SkillVersionRow = typeof skillVersions.$inferSelect;

export const REPUTATION_INPUT_TYPES = ['skill_published', 'version_published', 'report_actioned'] as const;
export const reputationInputType = pgEnum('reputation_input_type', REPUTATION_INPUT_TYPES);

// The ledger is the truth, users.reputation is the cached roll-up; rows are
// never edited, and they store the weight they were awarded with.
export const reputationInputs = pgTable('reputation_inputs', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id),
	type: reputationInputType('type').notNull(),
	weight: integer('weight').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ReputationInputRow = typeof reputationInputs.$inferSelect;

export const downloadSource = pgEnum('download_source', ['web', 'cli']);

// The overview's Download/InstallEvent model - first-party install counts
// roll up from here. userId is attribution only; downloads stay anonymous.
export const downloadEvents = pgTable('download_events', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	skillVersionId: integer('skill_version_id')
		.notNull()
		.references(() => skillVersions.id),
	userId: integer('user_id').references(() => users.id),
	source: downloadSource('source').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DownloadEventRow = typeof downloadEvents.$inferSelect;

export const abuseReportStatus = pgEnum('abuse_report_status', ABUSE_REPORT_STATUSES);

// Append-only from the public side; only admin actions (10c) change status.
export const abuseReports = pgTable('abuse_reports', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	skillId: integer('skill_id')
		.notNull()
		.references(() => skills.id),
	reporterId: integer('reporter_id')
		.notNull()
		.references(() => users.id),
	reason: text('reason').notNull(),
	status: abuseReportStatus('status').notNull().default('open'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AbuseReportRow = typeof abuseReports.$inferSelect;

// Immutable by omission: no update path exists for passports.
export const skillPassports = pgTable('skill_passports', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	skillVersionId: integer('skill_version_id')
		.notNull()
		.unique()
		.references(() => skillVersions.id),
	passport: jsonb('passport').$type<SkillPassport>().notNull(),
	validationStatus: validationStatus('validation_status').notNull(),
	riskLevel: riskLevel('risk_level').notNull(),
	generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
});

export type SkillPassportRow = typeof skillPassports.$inferSelect;

// The AI skill review (feature 18), cached by source hash so a given snapshot is
// reviewed once no matter how many versions or skills share it.
export const aiReviews = pgTable('ai_reviews', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	sourceHash: text('source_hash').notNull().unique(),
	review: jsonb('review').$type<AiReview>().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AiReviewRow = typeof aiReviews.$inferSelect;

// One embedding per skill, of its current listing copy. contentHash is
// sha256(model + input text), so unchanged copy is never re-embedded; the
// dimension is fixed in DDL, so a model swap is a migration + re-embed.
// Sized to the Voyage model in search/embeddings.ts; changing the model means a migration.
export const EMBEDDING_DIMENSIONS = 1024;

export const skillEmbeddings = pgTable('skill_embeddings', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	skillId: integer('skill_id')
		.notNull()
		.unique()
		.references(() => skills.id),
	embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
	contentHash: text('content_hash').notNull(),
	model: text('model').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SkillEmbeddingRow = typeof skillEmbeddings.$inferSelect;
