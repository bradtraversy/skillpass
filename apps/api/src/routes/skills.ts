import { Hono } from 'hono';
import type { Db } from '../db/client';
import {
	findPublishedSkillBySlug,
	listPublishedSkills,
	listVersionsWithPassports,
	publicSkillDetail,
	publicSkillSummary,
} from '../db/skills';

// Public, anonymous, read-only: the directory listing and skill detail.
export function skillRoutes(db: Db) {
	const routes = new Hono();

	routes.get('/', async (c) => {
		const records = await listPublishedSkills(db);
		return c.json({ success: true, data: records.map(publicSkillSummary) });
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
