import { Hono } from 'hono';
import type { PublicProfile } from 'skill-schema';
import type { Db } from '../db/client';
import { listPublishedSkillsByMaintainer, publicSkillSummary } from '../db/skills';
import { findByUsername } from '../db/users';

// Public, anonymous maintainer profiles.
export function userRoutes(db: Db) {
	const routes = new Hono();

	routes.get('/:username', async (c) => {
		const user = await findByUsername(db, c.req.param('username'));
		if (!user) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const records = await listPublishedSkillsByMaintainer(db, user.id);
		const data: PublicProfile = {
			username: user.username,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl,
			reputation: user.reputation,
			joinedAt: user.createdAt.toISOString(),
			skills: records.map(publicSkillSummary),
		};
		return c.json({ success: true, data });
	});

	return routes;
}
