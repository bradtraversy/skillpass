import {
	nextVersion,
	slugForSkill,
	type Distribution,
	type PublishResult,
	type Target,
} from 'skill-schema';
import type { Db } from '../db/client';
import type { SubmissionRow, ValidationReportRow } from '../db/schema';
import {
	createSkill,
	createSkillPassport,
	createSkillVersion,
	findLatestVersionForSkill,
	findSkillBySlug,
	setLatestVersion,
} from '../db/skills';
import { setSubmissionStatus } from '../db/submissions';
import type { Env } from '../env';
import { awardReputation } from '../reputation/reputation';
import { ensureAiReview, ensureCategory, ensureDisplayCopy } from '../review/ensure';
import { buildPassport } from './passport';

export interface PublishInput {
	submission: SubmissionRow;
	report: ValidationReportRow;
	name: string;
	summary: string;
	targets: Target[];
	// Default to a downloadable, author-declared skill; the publish route passes
	// the real values read from the (possibly inferred) manifest.
	distribution?: Distribution;
	homepage?: string;
	install?: string;
	manifestInferred?: boolean;
	attributedTo: string | null;
	// Admin-curated adds come in verified; a maintainer's own publish does not.
	verified?: boolean;
	// When provided, an AI review is generated and cached for this source hash.
	// Absent -> publish proceeds with no review (existing callers, tests).
	env?: Env;
	now?: Date;
}

export type PublishOutcome =
	| { success: true; data: PublishResult }
	| { success: false; error: 'slug_taken' };

// No transactions on neon-http: writes are ordered so every prefix is
// consistent, with the version insert (unique submissionId) as the commit
// point - a retry after a partial failure conflicts there instead of
// duplicating.
export async function publishSubmission(db: Db, input: PublishInput): Promise<PublishOutcome> {
	const { submission } = input;
	const now = input.now ?? new Date();

	const slug = slugForSkill(input.name);
	const existing = await findSkillBySlug(db, slug);
	if (existing && existing.maintainerId !== submission.userId) {
		return { success: false, error: 'slug_taken' };
	}

	const skill =
		existing ??
		(await createSkill(db, {
			slug,
			name: input.name,
			summary: input.summary,
			maintainerId: submission.userId,
			attributedTo: input.attributedTo,
			status: 'published',
			verified: input.verified ?? false,
		}));

	const latest = await findLatestVersionForSkill(db, skill.id);
	const version = nextVersion(latest?.version ?? null);

	const versionRow = await createSkillVersion(db, {
		skillId: skill.id,
		version,
		sourceType: submission.sourceType === 'github_url' ? 'github' : 'zip',
		githubRepoUrl: submission.githubUrl,
		resolvedCommitSha: submission.resolvedCommitSha,
		sourceHash: submission.sourceHash,
		snapshotKey: submission.snapshotKey,
		targets: input.targets,
		submissionId: submission.id,
		publishedAt: now,
	});

	const passport = buildPassport(
		input.report,
		submission,
		{
			distribution: input.distribution ?? 'skill',
			homepage: input.homepage,
			install: input.install,
			inferred: input.manifestInferred ?? false,
		},
		{ now },
	);
	await createSkillPassport(db, {
		skillVersionId: versionRow.id,
		passport,
		validationStatus: passport.validationStatus,
		riskLevel: passport.riskLevel,
		generatedAt: now,
	});

	await setLatestVersion(db, skill.id, versionRow.id, { name: input.name, summary: input.summary }, now);
	await setSubmissionStatus(db, submission.id, 'published');

	if (input.env) {
		await ensureAiReview(input.env, db, submission.sourceHash, submission.snapshotKey, input.report.report);
		await ensureCategory(input.env, db, {
			id: skill.id,
			slug,
			category: skill.category,
			name: input.name,
			summary: input.summary,
		});
		await ensureDisplayCopy(input.env, db, {
			id: skill.id,
			slug,
			displayName: skill.displayName,
			tagline: skill.tagline,
			name: input.name,
			summary: input.summary,
		});
	}

	try {
		await awardReputation(db, submission.userId, existing ? 'version_published' : 'skill_published');
	} catch (err) {
		// Reputation is derived data; an award failure must not fail the publish.
		console.error(`publish: reputation award failed for user ${submission.userId}: ${err}`);
	}

	return { success: true, data: { slug, version } };
}
