import { strToU8, zipSync } from 'fflate';
import { Hono, type Context } from 'hono';
import {
	diffPermissions,
	parseAbuseReportInput,
	type PublicAbuseReport,
	type PublicPreflight,
	type PublicSkillSource,
} from 'skill-schema';
import { loadPackageFromFiles, type PackageFile } from 'validator';
import { readSessionUserId, requireAuth, type AuthVariables } from '../auth/middleware';
import type { Db } from '../db/client';
import { createAbuseReport, findOpenReportBySkillAndReporter } from '../db/abuse';
import { recordDownload } from '../db/downloads';
import { searchSkillsByEmbedding } from '../db/embeddings';
import { findAiReviewByHash } from '../db/reviews';
import { embedTexts } from '../search/embeddings';
import { createRateLimiter, rateLimitMiddleware } from './rate-limit';
import {
	findPublishedSkillBySlug,
	findSkillBySlug,
	findVersionWithPassport,
	listPublishedSkills,
	listVersionsWithPassports,
	publicSkillDetail,
	publicSkillSummary,
	setSkillStatus,
	type PublishedSkillRecord,
	type VersionWithPassport,
} from '../db/skills';
import type { Env } from '../env';
import { getSnapshotDocument, type SnapshotDocument } from '../storage/r2';

export const BLOCKED_REASON = 'this version failed validation and cannot be downloaded';

const notFound = (c: Context) => c.json({ success: false, error: 'not found' }, 404);

interface PinnedHit {
	record: PublishedSkillRecord;
	pinned: VersionWithPassport;
}

// The version-pinned routes all start here: an unpublished slug or an unknown
// version is a plain 404 before anything touches R2.
async function findPinned(db: Db, slug: string, version: string): Promise<PinnedHit | undefined> {
	const record = await findPublishedSkillBySlug(db, slug);
	if (!record) return undefined;
	const pinned = await findVersionWithPassport(db, record.skill.id, version);
	return pinned && { record, pinned };
}

// An R2 outage is the caller's problem to retry, not a 500: log which route
// and version failed, answer 502.
async function snapshotOr502(
	c: Context,
	env: Env,
	route: string,
	hit: PinnedHit,
): Promise<SnapshotDocument | Response> {
	const snapshot = await getSnapshotDocument(env, hit.pinned.version.snapshotKey);
	if (snapshot.success) return snapshot.data;
	console.error(
		`${route}: snapshot fetch failed for ${hit.record.skill.slug}@${hit.pinned.version.version}: ${snapshot.error}`,
	);
	return c.json({ success: false, error: 'could not fetch the source snapshot; try again' }, 502);
}

// The pre-flight report: the pinned passport's verdict, the source hash
// re-verified against the snapshot the validator saw, and the permission diff
// against the previous published version (null for the first).
function buildPreflight(
	pinned: VersionWithPassport,
	versions: VersionWithPassport[],
	files: PackageFile[],
): PublicPreflight {
	const passport = pinned.passport.passport;
	const index = versions.findIndex((v) => v.version.id === pinned.version.id);
	const previous = index === -1 ? undefined : versions[index + 1];
	const blocked = pinned.passport.validationStatus === 'failed';
	return {
		version: pinned.version.version,
		validationStatus: pinned.passport.validationStatus,
		riskLevel: pinned.passport.riskLevel,
		sourceHash: pinned.version.sourceHash,
		sourceVerified: loadPackageFromFiles(files).sourceHash === pinned.version.sourceHash,
		resolvedCommitSha: pinned.version.resolvedCommitSha,
		generatedAt: passport.generatedAt,
		permissions: passport.permissionsSummary,
		diff: previous
			? {
					previousVersion: previous.version.version,
					declared: diffPermissions(
						passport.permissionsSummary.declared,
						previous.passport.passport.permissionsSummary.declared,
					),
					detected: diffPermissions(
						passport.permissionsSummary.detected,
						previous.passport.passport.permissionsSummary.detected,
					),
				}
			: null,
		blocked,
		blockedReason: blocked ? BLOCKED_REASON : null,
	};
}

// Public, anonymous, read-only: directory listing, skill detail, version
// permalinks, and the pinned source view. Specific routes register first.
type ReportCtx = Context<{ Variables: AuthVariables }, '/:slug/report'>;

// One open report per reporter per skill; a repeat is a 409, not a duplicate row.
async function fileAbuseReport(c: ReportCtx, db: Db): Promise<Response> {
	const record = await findPublishedSkillBySlug(db, c.req.param('slug'));
	if (!record) {
		return notFound(c);
	}
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ success: false, error: 'send a JSON body with a reason' }, 400);
	}
	const parsed = parseAbuseReportInput(body);
	if (!parsed.success) {
		return c.json({ success: false, error: parsed.error }, 400);
	}
	const reporter = c.get('user');
	const existing = await findOpenReportBySkillAndReporter(db, record.skill.id, reporter.id);
	if (existing) {
		return c.json(
			{ success: false, error: 'you already have an open report for this skill' },
			409,
		);
	}
	const report = await createAbuseReport(db, {
		skillId: record.skill.id,
		reporterId: reporter.id,
		reason: parsed.data.reason,
	});
	const data: PublicAbuseReport = {
		status: report.status,
		createdAt: report.createdAt.toISOString(),
	};
	return c.json({ success: true, data }, 201);
}

export function skillRoutes(env: Env, db: Db) {
	// requireAuth guards only the report route; everything else stays anonymous.
	const routes = new Hono<{ Variables: AuthVariables }>();

	routes.post('/:slug/report', requireAuth(env, db), (c) => fileAbuseReport(c, db));

	// Owner-scoped status flips: unlist withdraws a published listing (versions,
	// passports, and snapshots stay immutable; the slug stays reserved), relist
	// restores it. Someone else's slug is a 404, never a 403 - no existence leak.
	const transitionHandler = (
		from: 'published' | 'private',
		to: 'published' | 'private',
		refusal: string,
	) => {
		return async (c: Context<{ Variables: AuthVariables }>) => {
			const skill = await findSkillBySlug(db, c.req.param('slug') ?? '');
			if (!skill || skill.maintainerId !== c.get('user').id) {
				return notFound(c);
			}
			if (skill.status !== from) {
				return c.json({ success: false, error: refusal }, 409);
			}
			await setSkillStatus(db, skill.id, to);
			return c.json({ success: true, data: { slug: skill.slug, status: to } });
		};
	};

	routes.post(
		'/:slug/unlist',
		requireAuth(env, db),
		transitionHandler('published', 'private', 'only a published skill can be unlisted'),
	);
	routes.post(
		'/:slug/relist',
		requireAuth(env, db),
		transitionHandler('private', 'published', 'only an unlisted skill can be relisted'),
	);

	routes.get('/', async (c) => {
		const records = await listPublishedSkills(db);
		return c.json({ success: true, data: records.map(publicSkillSummary) });
	});

	// Registered before the /:slug routes so "search" is never taken for a slug.
	// Every hit costs a provider embed call, hence the per-IP limiter.
	const searchLimiter = createRateLimiter(20, 60_000);
	routes.get('/search', rateLimitMiddleware(searchLimiter), async (c) => {
		const q = c.req.query('q')?.trim() ?? '';
		if (!q || q.length > 500) {
			return c.json({ success: false, error: 'q must be 1-500 characters' }, 400);
		}
		if (!env.VOYAGE_API_KEY) {
			return c.json({ success: false, error: 'AI search is not configured' }, 503);
		}
		const embedded = await embedTexts(env, [q], 'query');
		if (!embedded.success) {
			console.error(`search: query embed failed: ${embedded.error}`);
			return c.json({ success: false, error: 'AI search is temporarily unavailable' }, 502);
		}
		const records = await searchSkillsByEmbedding(db, embedded.data[0]);
		return c.json({ success: true, data: records.map(publicSkillSummary) });
	});

	routes.get('/:slug/:version/preflight', async (c) => {
		const hit = await findPinned(db, c.req.param('slug'), c.req.param('version'));
		if (!hit) return notFound(c);
		const snapshot = await snapshotOr502(c, env, 'preflight', hit);
		if (snapshot instanceof Response) return snapshot;
		const versions = await listVersionsWithPassports(db, hit.record.skill.id);
		return c.json({ success: true, data: buildPreflight(hit.pinned, versions, snapshot.files) });
	});

	routes.get('/:slug/:version/download', async (c) => {
		const source = c.req.query('source') ?? 'web';
		if (source !== 'web' && source !== 'cli') {
			return c.json({ success: false, error: 'source must be "web" or "cli"' }, 400);
		}
		const hit = await findPinned(db, c.req.param('slug'), c.req.param('version'));
		if (!hit) return notFound(c);
		const { record, pinned } = hit;
		if (pinned.passport.validationStatus === 'failed') {
			return c.json({ success: false, error: BLOCKED_REASON }, 403);
		}
		const snapshot = await snapshotOr502(c, env, 'download', hit);
		if (snapshot instanceof Response) return snapshot;
		// Never serve bytes that don't match the pinned hash.
		if (loadPackageFromFiles(snapshot.files).sourceHash !== pinned.version.sourceHash) {
			console.error(
				`download: snapshot failed integrity verification for ${record.skill.slug}@${pinned.version.version}`,
			);
			return c.json(
				{ success: false, error: 'the snapshot failed integrity verification; download refused' },
				502,
			);
		}
		const zip = zipSync(Object.fromEntries(snapshot.files.map((f) => [f.path, strToU8(f.content)])));
		const userId = await readSessionUserId(c, env);
		try {
			await recordDownload(db, { skillVersionId: pinned.version.id, userId, source });
		} catch (err) {
			// Attribution must never block a verified download.
			console.error(`download: event insert failed for version ${pinned.version.id}: ${err}`);
		}
		return c.body(zip, 200, {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${record.skill.slug}-${pinned.version.version}.zip"`,
		});
	});

	routes.get('/:slug/:version/source', async (c) => {
		const hit = await findPinned(db, c.req.param('slug'), c.req.param('version'));
		if (!hit) return notFound(c);
		const snapshot = await snapshotOr502(c, env, 'source', hit);
		if (snapshot instanceof Response) return snapshot;
		const data: PublicSkillSource = {
			version: hit.pinned.version.version,
			sourceHash: hit.pinned.version.sourceHash,
			files: snapshot.files,
		};
		return c.json({ success: true, data });
	});

	routes.get('/:slug/:version', async (c) => {
		const hit = await findPinned(db, c.req.param('slug'), c.req.param('version'));
		if (!hit) return notFound(c);
		const { record, pinned } = hit;
		const versions = await listVersionsWithPassports(db, record.skill.id);
		const review = (await findAiReviewByHash(db, pinned.version.sourceHash))?.review ?? null;
		return c.json({
			success: true,
			data: publicSkillDetail(
				{ ...record, version: pinned.version, passport: pinned.passport },
				versions,
				review,
			),
		});
	});

	routes.get('/:slug', async (c) => {
		const record = await findPublishedSkillBySlug(db, c.req.param('slug'));
		if (!record) return notFound(c);
		const versions = await listVersionsWithPassports(db, record.skill.id);
		const review = (await findAiReviewByHash(db, record.version.sourceHash))?.review ?? null;
		return c.json({ success: true, data: publicSkillDetail(record, versions, review) });
	});

	return routes;
}
