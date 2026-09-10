import { Hono } from 'hono';
import { requireAuth, type AuthVariables } from '../auth/middleware';
import { listReportsAgainstMaintainer, maintainerReport } from '../db/abuse';
import type { Db } from '../db/client';
import { listSkillsByMaintainer, maintainerSkill } from '../db/skills';
import { publicUser } from '../db/users';
import type { Env } from '../env';

export function meRoutes(env: Env, db: Db) {
	const routes = new Hono<{ Variables: AuthVariables }>();

	routes.use('*', requireAuth(env, db));

	routes.get('/', (c) => c.json({ success: true, data: publicUser(c.get('user')) }));

	routes.get('/skills', async (c) => {
		const rows = await listSkillsByMaintainer(db, c.get('user').id);
		return c.json({ success: true, data: rows.map(maintainerSkill) });
	});

	routes.get('/reports', async (c) => {
		const rows = await listReportsAgainstMaintainer(db, c.get('user').id);
		return c.json({ success: true, data: rows.map(maintainerReport) });
	});

	return routes;
}
