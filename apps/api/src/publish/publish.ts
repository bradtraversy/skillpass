import { nextVersion, slugForSkill, type PublishResult, type Target } from 'skill-schema';
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
import { buildPassport } from './passport';

export interface PublishInput {
	submission: SubmissionRow;
	report: ValidationReportRow;
	name: string;
	summary: string;
	targets: Target[];
	attributedTo: string | null;
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

	const passport = buildPassport(input.report, submission, { now });
	await createSkillPassport(db, {
		skillVersionId: versionRow.id,
		passport,
		validationStatus: passport.validationStatus,
		riskLevel: passport.riskLevel,
		generatedAt: now,
	});

	await setLatestVersion(db, skill.id, versionRow.id, { name: input.name, summary: input.summary }, now);
	await setSubmissionStatus(db, submission.id, 'published');

	return { success: true, data: { slug, version } };
}
