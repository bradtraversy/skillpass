import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { loadPackageFromFiles } from 'validator';
import { z } from 'zod';
import { requireAuth, type AuthVariables } from '../auth/middleware';
import type { Db } from '../db/client';
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
import { enqueueValidation, type ValidationQueue } from '../queue/queue';
import type { SourceErrorCode } from '../github/errors';
import { verifySubmitPermission } from '../github/ownership';
import { resolveCommit } from '../github/pin';
import { fetchSnapshot } from '../github/snapshot';
import { parseGithubUrl } from '../github/url';
import { MAX_ZIP_BYTES, type PublicValidation } from 'skill-schema';
import { putBytes, putJson, snapshotDocument, snapshotKey, uploadKey } from '../storage/r2';
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

// Fallback skill name for manifest-less zips; the filename is user input.
function nameFromFilename(filename: string): string {
	const base = filename
		.replace(/\.zip$/i, '')
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return base || 'upload';
}

// A Redis outage must not fail the submission: the job row records the error
// and the draft still returns 201.
async function queueValidation(db: Db, queue: ValidationQueue, submissionId: number) {
	try {
		const job = await createValidationJob(db, submissionId);
		const enqueued = await enqueueValidation(queue, submissionId);
		if (!enqueued.success) {
			await markValidationJobError(db, job.id, enqueued.error);
		} else if (enqueued.data) {
			await setValidationJobBullId(db, job.id, enqueued.data);
		}
	} catch (err) {
		console.error('queueValidation failed', err);
	}
}

export function submissionRoutes(env: Env, db: Db, queue: ValidationQueue) {
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
		await queueValidation(db, queue, row.id);
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
		await queueValidation(db, queue, row.id);
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
			// Summary only - findings stay private until feature 7's publish gate.
			report: report ? { status: report.status, riskLevel: report.riskLevel } : null,
		};
		return c.json({ success: true, data });
	});

	return routes;
}
