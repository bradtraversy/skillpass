import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { loadPackageFromFiles } from 'validator';
import { z } from 'zod';
import { requireAuth, type AuthVariables } from '../auth/middleware';
import type { Db } from '../db/client';
import type { SubmissionRow, UserRow } from '../db/schema';
import { findVersionBySubmission } from '../db/skills';
import {
	createSubmission,
	findSubmissionForUser,
	listSubmissionsForUser,
	publicSubmission,
} from '../db/submissions';
import {
	createValidationJob,
	findValidationJobForSubmission,
	findValidationReportForSubmission,
	markValidationJobError,
	setValidationJobBullId,
} from '../db/validation';
import type { Env } from '../env';
import { processValidationJob } from '../queue/processor';
import { enqueueValidation, type ValidationQueue } from '../queue/queue';
import type { SourceErrorCode } from '../github/errors';
import { verifySubmitPermission } from '../github/ownership';
import { resolveCommit } from '../github/pin';
import { fetchSnapshot } from '../github/snapshot';
import { parseGithubUrl } from '../github/url';
import { MAX_ZIP_BYTES, type PublicValidation } from 'skill-schema';
import { publishSubmission, type PublishOutcome } from '../publish/publish';
import {
	getSnapshotDocument,
	putBytes,
	putJson,
	snapshotDocument,
	snapshotKey,
	uploadKey,
} from '../storage/r2';
import { extractZip } from '../uploads/zip';

const SOURCE_ERROR_STATUS: Record<SourceErrorCode, ContentfulStatusCode> = {
	'bad-url': 400,
	forbidden: 403,
	'not-found': 404,
	'rate-limited': 429,
	upstream: 502,
	'bad-archive': 422,
	'too-large': 413,
	'empty-package': 422,
};

const createBody = z.object({ githubUrl: z.string().min(1) });

// passed and warning both publish (warnings surface in the passport); only these
// non-verdict or blocked states are refused.
const PUBLISH_REFUSALS: Record<Exclude<SubmissionRow['status'], 'passed' | 'warning'>, string> = {
	draft: 'submission has not been validated yet',
	validating: 'validation is still running; wait for it to finish',
	failed: 'failed validation cannot be published',
	published: 'already published',
};

const ALREADY_PUBLISHED = 'already published; contact support if the listing looks incomplete';

// Curation credit comes from the stored URL, never from client input; zip
// curation gets no attribution (no owner to verify).
function attributionFor(user: UserRow, submission: SubmissionRow): string | null {
	if (user.role !== 'admin' || submission.sourceType !== 'github_url' || !submission.githubUrl) {
		return null;
	}
	const parsed = parseGithubUrl(submission.githubUrl);
	if (!parsed.success) {
		return null;
	}
	const owner = parsed.data.owner;
	return owner.toLowerCase() === user.username.toLowerCase() ? null : owner;
}

// Fallback skill name for manifest-less zips; the filename is user input.
function nameFromFilename(filename: string): string {
	const base = filename
		.replace(/\.zip$/i, '')
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return base || 'upload';
}

// A validation failure must never fail the submission: the draft still returns
// 201. Inline mode runs the validator in-process; queue mode enqueues to the
// worker and the job row records any Redis outage.
async function startValidation(
	env: Env,
	db: Db,
	queue: ValidationQueue | null,
	submissionId: number,
) {
	try {
		const job = await createValidationJob(db, submissionId);
		if (env.VALIDATION_MODE === 'inline' || !queue) {
			// Fire-and-forget in-process: don't block the 201 on validation. The
			// job row it updates is what the submit-page progress panel polls.
			void processValidationJob(env, db, submissionId).catch((err) =>
				console.error('inline validation failed', err),
			);
			return;
		}
		const enqueued = await enqueueValidation(queue, submissionId);
		if (!enqueued.success) {
			await markValidationJobError(db, job.id, enqueued.error);
		} else if (enqueued.data) {
			await setValidationJobBullId(db, job.id, enqueued.data);
		}
	} catch (err) {
		console.error('startValidation failed', err);
	}
}

export function submissionRoutes(env: Env, db: Db, queue: ValidationQueue | null) {
	const routes = new Hono<{ Variables: AuthVariables }>();
	routes.use('*', requireAuth(env, db));

	routes.post('/', async (c) => {
		let raw: unknown;
		try {
			raw = await c.req.json();
		} catch {
			return c.json({ success: false, error: 'expected a JSON body' }, 400);
		}
		const body = createBody.safeParse(raw);
		if (!body.success) {
			return c.json({ success: false, error: 'githubUrl is required' }, 400);
		}

		const parsed = parseGithubUrl(body.data.githubUrl);
		if (!parsed.success) {
			return c.json({ success: false, error: parsed.error }, SOURCE_ERROR_STATUS[parsed.code]);
		}

		const permitted = await verifySubmitPermission(env, c.get('user'), parsed.data);
		if (!permitted.success) {
			return c.json(
				{ success: false, error: permitted.error },
				SOURCE_ERROR_STATUS[permitted.code],
			);
		}

		const pinned = await resolveCommit(env, parsed.data);
		if (!pinned.success) {
			return c.json({ success: false, error: pinned.error }, SOURCE_ERROR_STATUS[pinned.code]);
		}

		const snapshot = await fetchSnapshot(env, parsed.data, pinned.data);
		if (!snapshot.success) {
			return c.json({ success: false, error: snapshot.error }, SOURCE_ERROR_STATUS[snapshot.code]);
		}

		const pkg = loadPackageFromFiles(snapshot.data, parsed.data.repo);
		const key = snapshotKey(pkg.sourceHash);
		const stored = await putJson(env, key, snapshotDocument(pkg.files));
		if (!stored.success) {
			return c.json({ success: false, error: 'could not store the snapshot; try again' }, 502);
		}

		const row = await createSubmission(db, {
			userId: c.get('user').id,
			sourceType: 'github_url',
			githubUrl: body.data.githubUrl.trim(),
			resolvedCommitSha: pinned.data,
			sourceHash: pkg.sourceHash,
			snapshotKey: key,
		});
		await startValidation(env, db, queue, row.id);
		return c.json({ success: true, data: publicSubmission(row) }, 201);
	});

	// Zip uploads have no repo owner to verify; they are honor-system under the
	// ToS ("own or have permission"), with abuse reports as the backstop.
	routes.post('/zip', async (c) => {
		let form: Record<string, unknown>;
		try {
			form = await c.req.parseBody();
		} catch {
			return c.json({ success: false, error: 'expected a multipart body with a "file" zip' }, 400);
		}
		const file = form.file;
		if (!(file instanceof File)) {
			return c.json({ success: false, error: 'expected a multipart body with a "file" zip' }, 400);
		}
		if (file.size > MAX_ZIP_BYTES) {
			return c.json(
				{ success: false, error: `zip exceeds ${MAX_ZIP_BYTES / 1024 / 1024} MB` },
				413,
			);
		}

		const bytes = new Uint8Array(await file.arrayBuffer());
		const extracted = extractZip(bytes);
		if (!extracted.success) {
			return c.json({ success: false, error: extracted.error }, SOURCE_ERROR_STATUS[extracted.code]);
		}

		const pkg = loadPackageFromFiles(extracted.data, nameFromFilename(file.name));
		const zipKey = uploadKey(createHash('sha256').update(bytes).digest('hex'));
		const storedZip = await putBytes(env, zipKey, bytes, 'application/zip');
		if (!storedZip.success) {
			return c.json({ success: false, error: 'could not store the upload; try again' }, 502);
		}
		const key = snapshotKey(pkg.sourceHash);
		const storedSnapshot = await putJson(env, key, snapshotDocument(pkg.files));
		if (!storedSnapshot.success) {
			return c.json({ success: false, error: 'could not store the snapshot; try again' }, 502);
		}

		const row = await createSubmission(db, {
			userId: c.get('user').id,
			sourceType: 'zip',
			uploadedZipKey: zipKey,
			sourceHash: pkg.sourceHash,
			snapshotKey: key,
		});
		await startValidation(env, db, queue, row.id);
		return c.json({ success: true, data: publicSubmission(row) }, 201);
	});

	routes.get('/', async (c) => {
		const rows = await listSubmissionsForUser(db, c.get('user').id);
		return c.json({ success: true, data: rows.map(publicSubmission) });
	});

	routes.get('/:id', async (c) => {
		const id = Number(c.req.param('id'));
		if (!Number.isInteger(id)) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const row = await findSubmissionForUser(db, c.get('user').id, id);
		if (!row) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		return c.json({ success: true, data: publicSubmission(row) });
	});

	routes.get('/:id/validation', async (c) => {
		const id = Number(c.req.param('id'));
		if (!Number.isInteger(id)) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const row = await findSubmissionForUser(db, c.get('user').id, id);
		if (!row) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const job = await findValidationJobForSubmission(db, id);
		const report = await findValidationReportForSubmission(db, id);
		const data: PublicValidation = {
			job: job ? { state: job.state, progress: job.progress, error: job.error } : null,
			submissionStatus: row.status,
			// Owner-visible findings; sourceHash/engineVersion/permissions stay internal.
			report: report
				? {
						status: report.status,
						riskLevel: report.riskLevel,
						warnings: report.report.warnings,
						failures: report.report.failures,
					}
				: null,
		};
		return c.json({ success: true, data });
	});

	routes.post('/:id/publish', async (c) => {
		const id = Number(c.req.param('id'));
		if (!Number.isInteger(id)) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const submission = await findSubmissionForUser(db, c.get('user').id, id);
		if (!submission) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		if (submission.status !== 'passed' && submission.status !== 'warning') {
			return c.json({ success: false, error: PUBLISH_REFUSALS[submission.status] }, 409);
		}

		// Partial-failure guard: a version row with a non-published submission
		// means an earlier publish crashed mid-sequence.
		const existingVersion = await findVersionBySubmission(db, id);
		if (existingVersion) {
			console.error(
				`publish: submission ${id} has version ${existingVersion.id} but status "${submission.status}"`,
			);
			return c.json({ success: false, error: ALREADY_PUBLISHED }, 409);
		}

		// Defense in depth alongside the submission status check.
		const report = await findValidationReportForSubmission(db, id);
		if (!report || report.status === 'failed') {
			return c.json(
				{ success: false, error: 'no publishable validation report on record; re-run validation' },
				409,
			);
		}

		const snapshot = await getSnapshotDocument(env, submission.snapshotKey);
		if (!snapshot.success) {
			console.error(`publish: snapshot fetch failed for submission ${id}: ${snapshot.error}`);
			return c.json(
				{ success: false, error: 'could not fetch the validated snapshot; try again' },
				502,
			);
		}

		const pkg = loadPackageFromFiles(snapshot.data.files, `submission-${id}`);
		if (pkg.manifest.state !== 'ok') {
			// Passed validation implies a valid manifest; this is stored-state corruption.
			console.error(
				`publish: submission ${id} passed validation but its manifest is ${pkg.manifest.state}`,
			);
			return c.json({ success: false, error: 'stored snapshot is inconsistent; contact support' }, 500);
		}

		let outcome: PublishOutcome;
		try {
			outcome = await publishSubmission(db, {
				submission,
				report,
				name: pkg.manifest.data.name,
				summary: pkg.manifest.data.description,
				targets: pkg.manifest.data.targets,
				distribution: pkg.manifest.data.distribution,
				homepage: pkg.manifest.data.homepage,
				install: pkg.manifest.data.install,
				manifestInferred: pkg.manifest.inferred ?? false,
				attributedTo: attributionFor(c.get('user'), submission),
				verified: c.get('user').role === 'admin',
			});
		} catch (err) {
			// Concurrent publish race: the unique constraints are the backstop.
			const pgErr = err as { code?: string; constraint?: string };
			if (pgErr.code === '23505') {
				console.error(`publish: unique conflict for submission ${id}`, err);
				// A version-number collision means we raced another publish of the
				// same skill; unlike the other conflicts, a retry succeeds.
				const error =
					pgErr.constraint === 'skills_slug_unique'
						? 'that skill name is already taken'
						: pgErr.constraint === 'skill_versions_skill_id_version_unique'
							? 'another publish for this skill was in flight; try again'
							: ALREADY_PUBLISHED;
				return c.json({ success: false, error }, 409);
			}
			throw err;
		}
		if (!outcome.success) {
			return c.json({ success: false, error: 'that skill name is already taken' }, 409);
		}
		return c.json({ success: true, data: outcome.data }, 201);
	});

	return routes;
}
