import { slugForSkill } from 'skill-schema';
import { loadPackageFromFiles } from 'validator';
import type { Db } from '../db/client';
import { findSkillBySlug, setSkillCuration } from '../db/skills';
import { FEATURED_SLUGS } from './listings';
import { createSubmission } from '../db/submissions';
import { createValidationJob, findValidationReportForSubmission } from '../db/validation';
import type { Env } from '../env';
import { resolveCommit } from '../github/pin';
import { fetchSnapshot } from '../github/snapshot';
import { packageNameFor, parseGithubUrl } from '../github/url';
import { publishFieldsFrom, publishSubmission } from '../publish/publish';
import { processValidationJob } from '../queue/processor';
import { putJson, snapshotDocument, snapshotKey } from '../storage/r2';

export interface CurateInput {
	githubUrl: string;
	ownerUserId: number;
	attributedTo: string;
	// Curation-time listing name; overrides the inferred manifest name (and so
	// the slug) when a source folder's own name is too generic to own globally.
	name?: string;
}

export interface CurateResult {
	slug: string | null;
	status: 'published' | 'skipped' | 'failed';
	reason?: string;
}

// Features every FEATURED_SLUGS entry at its list position (rank = index + 1).
// Additive: slugs removed from the roster stay featured until an admin unfeatures
// them. Returns the slugs with no published skill so the runner can report a
// typo'd or failed roster entry instead of silently skipping it.
export async function applyFeaturedRanks(db: Db): Promise<string[]> {
	const missing: string[] = [];
	for (const [index, slug] of FEATURED_SLUGS.entries()) {
		const skill = await findSkillBySlug(db, slug);
		if (!skill) {
			missing.push(slug);
			continue;
		}
		await setSkillCuration(db, skill.id, { featured: true, featuredRank: index + 1 });
	}
	return missing;
}

// Drives one source through the real submit -> validate -> publish pipeline, the
// same functions the routes use, but awaits validation inline. Idempotent (skips
// an existing slug) and fault-isolated (any thrown error becomes a failed result)
// so one bad source never aborts a seed batch.
export async function curateSkill(env: Env, db: Db, input: CurateInput): Promise<CurateResult> {
	try {
		const parsed = parseGithubUrl(input.githubUrl);
		if (!parsed.success) return { slug: null, status: 'failed', reason: parsed.error };

		const pinned = await resolveCommit(env, parsed.data);
		if (!pinned.success) return { slug: null, status: 'failed', reason: pinned.error };

		const snapshot = await fetchSnapshot(env, parsed.data, pinned.data);
		if (!snapshot.success) return { slug: null, status: 'failed', reason: snapshot.error };

		const pkg = loadPackageFromFiles(snapshot.data, packageNameFor(parsed.data));
		if (pkg.manifest.state !== 'ok') {
			return { slug: null, status: 'failed', reason: `manifest ${pkg.manifest.state}` };
		}
		const manifest = pkg.manifest.data;
		const name = input.name ?? manifest.name;
		const slug = slugForSkill(name);

		// Idempotent: a skill with this slug already exists, so this source was
		// seeded on a prior run. Skip before any write, so re-runs are no-ops.
		if (await findSkillBySlug(db, slug)) return { slug, status: 'skipped' };

		const key = snapshotKey(pkg.sourceHash);
		const stored = await putJson(env, key, snapshotDocument(pkg.files));
		if (!stored.success) return { slug, status: 'failed', reason: 'snapshot store failed' };

		const submission = await createSubmission(db, {
			userId: input.ownerUserId,
			sourceType: 'github_url',
			githubUrl: input.githubUrl,
			resolvedCommitSha: pinned.data,
			sourceHash: pkg.sourceHash,
			snapshotKey: key,
		});

		await createValidationJob(db, submission.id);
		await processValidationJob(env, db, submission.id);

		const report = await findValidationReportForSubmission(db, submission.id);
		if (!report || report.status === 'failed') {
			return { slug, status: 'failed', reason: `validation ${report?.status ?? 'missing'}` };
		}

		const outcome = await publishSubmission(db, {
			submission,
			report,
			...publishFieldsFrom(manifest, pkg.manifest.inferred ?? false),
			name,
			attributedTo: input.attributedTo,
			verified: true,
			env,
		});
		if (!outcome.success) return { slug, status: 'failed', reason: outcome.error };

		return { slug, status: 'published' };
	} catch (err) {
		return { slug: null, status: 'failed', reason: err instanceof Error ? err.message : String(err) };
	}
}
