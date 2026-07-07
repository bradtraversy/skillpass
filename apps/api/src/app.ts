import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, type AuthVariables } from './auth/middleware';
import type { Db } from './db/client';
import { publicUser } from './db/users';
import type { Env } from './env';
import type { ValidationQueue } from './queue/queue';
import { authRoutes } from './routes/auth';
import { skillRoutes } from './routes/skills';
import { submissionRoutes } from './routes/submissions';

export function createApp(env: Env, db: Db, queue: ValidationQueue) {
	const app = new Hono<{ Variables: AuthVariables }>();

	app.onError((err, c) => {
		console.error(err);
		return c.json({ success: false, error: 'internal error' }, 500);
	});

	app.use('*', cors({ origin: env.WEB_ORIGIN, credentials: true }));

	app.get('/health', (c) => c.json({ success: true, data: { status: 'ok' } }));

	app.route('/auth', authRoutes(env, db));
	app.route('/skills', skillRoutes(env, db));
	app.route('/submissions', submissionRoutes(env, db, queue));

	app.get('/me', requireAuth(env, db), (c) =>
		c.json({ success: true, data: publicUser(c.get('user')) }),
	);

	return app;
}
