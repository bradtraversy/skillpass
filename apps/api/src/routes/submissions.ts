import { createHash } from 'node:crypto';
import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { loadPackageFromFiles, type LoadedPackage } from 'validator';
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
import { handleValidationFailure, processValidationJob } from '../queue/processor';
import { enqueueValidation, type ValidationQueue } from '../queue/queue';
import type { SourceErrorCode } from '../github/errors';
import { verifySubmitPermission } from '../github/ownership';
import { resolveCommit } from '../github/pin';
import { fetchSnapshot } from '../github/snapshot';
import { packageNameFor, parseGithubUrl } from '../github/url';
import { MAX_ZIP_BYTES, type DetectedPackage, type PublicValidation } from 'skill-schema';
import { MIN_PACK_SKILLS, publishFieldsFrom, publishSubmission, type PublishOutcome } from '../publish/publish';
import {
	getSnapshotDocument,
	putBytes,
	putJson,
	snapshotDocument,
	snapshotKey,
	uploadKey,
} from '../storage/r2';
import { extractZip } from '../uploads/zip';
import { createRateLimiter, rateLimitMiddleware } from './rate-limit';

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

function detectPackage(pkg: LoadedPackage): DetectedPackage {
	const skills = pkg.manifest.state === 'ok' ? (pkg.manifest.data.skills ?? []) : [];
	return {
		skillMd: pkg.files.some((f) => f.path === 'SKILL.md'),
		manifest:
			pkg.manifest.state === 'ok' ? (pkg.manifest.inferred ? 'inferred' : 'ok') : pkg.manifest.state,
		name: pkg.manifest.state === 'ok' ? pkg.manifest.data.name : null,
		skillCount: skills.length >= MIN_PACK_SKILLS ? skills.length : null,
	};
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
			// job row it updates is what the submit-page progress panel polls. A
			// throw lands after the job is marked running, so record it as the
			// worker does or the submission stays "validating" with no way out.
			void processValidationJob(env, db, submissionId).catch(async (err) => {
				console.error('inline validation failed', err);
				try {
					await handleValidationFailure(
						db,
						submissionId,
						err instanceof Error ? err.message : String(err),
					);
				} catch (dbErr) {
					console.error('could not record inline validation failure', dbErr);
				}
			});
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

type Ctx = Context<{ Variables: AuthVariables }>;

interface Deps {
	env: Env;
	db: Db;
	queue: ValidationQueue | null;
}

// GitHub URL submission: verify ownership, pin the commit, snapshot to R2, and
// start validation without blocking the 201.
async function createFromGithub(c: Ctx, { env, db, queue }: Deps): Promise<Response> {
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

	const pkg = loadPackageFromFiles(snapshot.data, packageNameFor(parsed.data));
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
	return c.json(
		{ success: true, data: { ...publicSubmission(row), detected: detectPackage(pkg) } },
		201,
	);
}
// Zip uploads have no repo owner to verify; they are honor-system under the
// ToS ("own or have permission"), with abuse reports as the backstop.
async function createFromZip(c: Ctx, { env, db, queue }: Deps): Promise<Response> {
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
	return c.json(
		{ success: true, data: { ...publicSubmission(row), detected: detectPackage(pkg) } },
		201,
	);
}
// A unique-constraint failure means a concurrent publish raced this one; the
// constraint name decides the message. Null for any other error.
function publishConflict(err: unknown): string | null {
	const pgErr = err as { code?: string; constraint?: string };
	if (pgErr.code !== '23505') return null;
	if (pgErr.constraint === 'skills_slug_unique') return 'that skill name is already taken';
	// A version-number collision is a race with another publish of the same
	// skill; unlike the other conflicts, a retry succeeds.
	if (pgErr.constraint === 'skill_versions_skill_id_version_unique') {
		return 'another publish for this skill was in flight; try again';
	}
	return ALREADY_PUBLISHED;
}

// The fallback name feeds pack inference (a pack is named from it), so prefer
// the source folder or repo name over an opaque submission id.
function sourceNameFor(submission: SubmissionRow): string | null {
	if (!submission.githubUrl) return null;
	const parsed = parseGithubUrl(submission.githubUrl);
	return parsed.success ? packageNameFor(parsed.data) : null;
}

async function publish(c: Ctx, { env, db }: Deps): Promise<Response> {
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

	const pkg = loadPackageFromFiles(snapshot.data.files, sourceNameFor(submission) ?? `submission-${id}`);
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
			...publishFieldsFrom(pkg.manifest.data, pkg.manifest.inferred ?? false),
			attributedTo: attributionFor(c.get('user'), submission),
			verified: c.get('user').role === 'admin',
			env,
		});
	} catch (err) {
		const conflict = publishConflict(err);
		if (!conflict) throw err;
		console.error(`publish: unique conflict for submission ${id}`, err);
		return c.json({ success: false, error: conflict }, 409);
	}
	if (!outcome.success) {
		return c.json({ success: false, error: 'that skill name is already taken' }, 409);
	}
	return c.json({ success: true, data: outcome.data }, 201);
}
export function submissionRoutes(env: Env, db: Db, queue: ValidationQueue | null) {
	const routes = new Hono<{ Variables: AuthVariables }>();
	const deps: Deps = { env, db, queue };
	routes.use('*', requireAuth(env, db));

	// Each submission costs a GitHub fetch, an R2 write, and a validation run.
	const perUser = rateLimitMiddleware(createRateLimiter(20, 60 * 60_000), (c) => `user:${c.get('user').id}`);
	routes.post('/', perUser, (c) => createFromGithub(c, deps));

	routes.post('/zip', perUser, (c) => createFromZip(c, deps));

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

	routes.post('/:id/publish', (c) => publish(c, deps));

	return routes;
}
