import { slugForSkill } from 'skill-schema';
import { loadPackageFromFiles } from 'validator';
import type { Db } from '../db/client';
import { findSkillBySlug } from '../db/skills';
import { createSubmission } from '../db/submissions';
import { createValidationJob, findValidationReportForSubmission } from '../db/validation';
import type { Env } from '../env';
import { resolveCommit } from '../github/pin';
import { fetchSnapshot } from '../github/snapshot';
import { parseGithubUrl } from '../github/url';
import { publishSubmission } from '../publish/publish';
import { processValidationJob } from '../queue/processor';
import { putJson, snapshotDocument, snapshotKey } from '../storage/r2';

export interface CurateInput {
	githubUrl: string;
	ownerUserId: number;
	attributedTo: string;
}

export interface CurateResult {
	slug: string | null;
	status: 'published' | 'skipped' | 'failed';
	reason?: string;
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

		const pkg = loadPackageFromFiles(snapshot.data, parsed.data.repo);
		if (pkg.manifest.state !== 'ok') {
			return { slug: null, status: 'failed', reason: `manifest ${pkg.manifest.state}` };
		}
		const manifest = pkg.manifest.data;
		const slug = slugForSkill(manifest.name);

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
			name: manifest.name,
			summary: manifest.description,
			targets: manifest.targets,
			distribution: manifest.distribution,
			homepage: manifest.homepage,
			install: manifest.install,
			manifestInferred: pkg.manifest.inferred ?? false,
			attributedTo: input.attributedTo,
			verified: true,
		});
		if (!outcome.success) return { slug, status: 'failed', reason: outcome.error };

		return { slug, status: 'published' };
	} catch (err) {
		return { slug: null, status: 'failed', reason: err instanceof Error ? err.message : String(err) };
	}
}
