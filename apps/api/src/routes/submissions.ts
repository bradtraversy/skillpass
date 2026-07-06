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
import type { Env } from '../env';
import type { SourceErrorCode } from '../github/errors';
import { verifySubmitPermission } from '../github/ownership';
import { resolveCommit } from '../github/pin';
import { fetchSnapshot } from '../github/snapshot';
import { parseGithubUrl } from '../github/url';
import { putJson, snapshotDocument, snapshotKey } from '../storage/r2';

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

export function submissionRoutes(env: Env, db: Db) {
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

	return routes;
}
