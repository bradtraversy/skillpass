import {
	nextVersion,
	slugForSkill,
	type Distribution,
	type Manifest,
	type PublishResult,
	type SkillEntry,
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
import {
	ensureAiReview,
	ensureCategory,
	ensureDisplayCopy,
	ensureIntegrations,
} from '../review/ensure';
import { ensureEmbedding } from '../search/ensure';
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
	// The manifest's skills[] when the package is a multi-skill pack; the callers
	// pass null for single skills (including one-entry skills[] manifests).
	packSkills?: SkillEntry[] | null;
	attributedTo: string | null;
	// Admin-curated adds come in verified; a maintainer's own publish does not.
	verified?: boolean;
	// When provided, an AI review is generated and cached for this source hash.
	// Absent -> publish proceeds with no review (existing callers, tests).
	env?: Env;
	now?: Date;
}

// A listing is a pack only with two or more member skills; a one-entry
// skills[] is still a single skill.
export const MIN_PACK_SKILLS = 2;

function packSkillsOf(manifest: Manifest): SkillEntry[] | null {
	return (manifest.skills?.length ?? 0) >= MIN_PACK_SKILLS ? (manifest.skills ?? null) : null;
}

// The PublishInput fields that come straight from a loaded manifest; the
// submit route and the curate seed publish through this one mapping.
export function publishFieldsFrom(
	manifest: Manifest,
	inferred = false,
): Pick<
	PublishInput,
	'name' | 'summary' | 'targets' | 'distribution' | 'homepage' | 'install' | 'manifestInferred' | 'packSkills'
> {
	return {
		name: manifest.name,
		summary: manifest.description,
		targets: manifest.targets,
		distribution: manifest.distribution,
		homepage: manifest.homepage,
		install: manifest.install,
		manifestInferred: inferred,
		packSkills: packSkillsOf(manifest),
	};
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
		packSkills: input.packSkills ?? null,
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
		await ensureIntegrations(input.env, db, {
			id: skill.id,
			slug,
			integrations: skill.integrations,
			name: input.name,
			summary: input.summary,
		});
		// Last in the chain: embeds the final listing copy the ensures above wrote.
		await ensureEmbedding(input.env, db, slug);
	}

	try {
		await awardReputation(db, submission.userId, existing ? 'version_published' : 'skill_published');
	} catch (err) {
		// Reputation is derived data; an award failure must not fail the publish.
		console.error(`publish: reputation award failed for user ${submission.userId}: ${err}`);
	}

	return { success: true, data: { slug, version } };
}
