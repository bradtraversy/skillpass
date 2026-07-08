import { strToU8, zipSync } from 'fflate';
import { Hono } from 'hono';
import { diffPermissions, type PublicPreflight, type PublicSkillSource } from 'skill-schema';
import { loadPackageFromFiles, type PackageFile } from 'validator';
import { readSessionUserId } from '../auth/middleware';
import type { Db } from '../db/client';
import { recordDownload } from '../db/downloads';
import {
	findPublishedSkillBySlug,
	findVersionWithPassport,
	listPublishedSkills,
	listVersionsWithPassports,
	publicSkillDetail,
	publicSkillSummary,
	type VersionWithPassport,
} from '../db/skills';
import type { Env } from '../env';
import { getSnapshotDocument } from '../storage/r2';

export const BLOCKED_REASON = 'this version failed validation and cannot be downloaded';

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
export function skillRoutes(env: Env, db: Db) {
	const routes = new Hono();

	routes.get('/', async (c) => {
		const records = await listPublishedSkills(db);
		return c.json({ success: true, data: records.map(publicSkillSummary) });
	});

	routes.get('/:slug/:version/preflight', async (c) => {
		const record = await findPublishedSkillBySlug(db, c.req.param('slug'));
		if (!record) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const pinned = await findVersionWithPassport(db, record.skill.id, c.req.param('version'));
		if (!pinned) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const snapshot = await getSnapshotDocument(env, pinned.version.snapshotKey);
		if (!snapshot.success) {
			console.error(
				`preflight: snapshot fetch failed for ${record.skill.slug}@${pinned.version.version}: ${snapshot.error}`,
			);
			return c.json({ success: false, error: 'could not fetch the source snapshot; try again' }, 502);
		}
		const versions = await listVersionsWithPassports(db, record.skill.id);
		return c.json({ success: true, data: buildPreflight(pinned, versions, snapshot.data.files) });
	});

	routes.get('/:slug/:version/download', async (c) => {
		const source = c.req.query('source') ?? 'web';
		if (source !== 'web' && source !== 'cli') {
			return c.json({ success: false, error: 'source must be "web" or "cli"' }, 400);
		}
		const record = await findPublishedSkillBySlug(db, c.req.param('slug'));
		if (!record) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const pinned = await findVersionWithPassport(db, record.skill.id, c.req.param('version'));
		if (!pinned) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		if (pinned.passport.validationStatus === 'failed') {
			return c.json({ success: false, error: BLOCKED_REASON }, 403);
		}
		const snapshot = await getSnapshotDocument(env, pinned.version.snapshotKey);
		if (!snapshot.success) {
			console.error(
				`download: snapshot fetch failed for ${record.skill.slug}@${pinned.version.version}: ${snapshot.error}`,
			);
			return c.json({ success: false, error: 'could not fetch the source snapshot; try again' }, 502);
		}
		// Never serve bytes that don't match the pinned hash.
		if (loadPackageFromFiles(snapshot.data.files).sourceHash !== pinned.version.sourceHash) {
			console.error(
				`download: snapshot failed integrity verification for ${record.skill.slug}@${pinned.version.version}`,
			);
			return c.json(
				{ success: false, error: 'the snapshot failed integrity verification; download refused' },
				502,
			);
		}
		const zip = zipSync(
			Object.fromEntries(snapshot.data.files.map((f) => [f.path, strToU8(f.content)])),
		);
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
		const record = await findPublishedSkillBySlug(db, c.req.param('slug'));
		if (!record) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const pinned = await findVersionWithPassport(db, record.skill.id, c.req.param('version'));
		if (!pinned) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const snapshot = await getSnapshotDocument(env, pinned.version.snapshotKey);
		if (!snapshot.success) {
			console.error(
				`source: snapshot fetch failed for ${record.skill.slug}@${pinned.version.version}: ${snapshot.error}`,
			);
			return c.json({ success: false, error: 'could not fetch the source snapshot; try again' }, 502);
		}
		const data: PublicSkillSource = {
			version: pinned.version.version,
			sourceHash: pinned.version.sourceHash,
			files: snapshot.data.files,
		};
		return c.json({ success: true, data });
	});

	routes.get('/:slug/:version', async (c) => {
		const record = await findPublishedSkillBySlug(db, c.req.param('slug'));
		if (!record) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const pinned = await findVersionWithPassport(db, record.skill.id, c.req.param('version'));
		if (!pinned) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const versions = await listVersionsWithPassports(db, record.skill.id);
		return c.json({
			success: true,
			data: publicSkillDetail(
				{ ...record, version: pinned.version, passport: pinned.passport },
				versions,
			),
		});
	});

	routes.get('/:slug', async (c) => {
		const record = await findPublishedSkillBySlug(db, c.req.param('slug'));
		if (!record) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const versions = await listVersionsWithPassports(db, record.skill.id);
		return c.json({ success: true, data: publicSkillDetail(record, versions) });
	});

	return routes;
}
