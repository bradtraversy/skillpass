import { Hono } from 'hono';
import type { PublicSkillSource } from 'skill-schema';
import type { Db } from '../db/client';
import {
	findPublishedSkillBySlug,
	findVersionWithPassport,
	listPublishedSkills,
	listVersionsWithPassports,
	publicSkillDetail,
	publicSkillSummary,
} from '../db/skills';
import type { Env } from '../env';
import { getSnapshotDocument } from '../storage/r2';

// Public, anonymous, read-only: directory listing, skill detail, version
// permalinks, and the pinned source view. Specific routes register first.
export function skillRoutes(env: Env, db: Db) {
	const routes = new Hono();

	routes.get('/', async (c) => {
		const records = await listPublishedSkills(db);
		return c.json({ success: true, data: records.map(publicSkillSummary) });
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
