import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { createValidationQueue } from './queue/queue';

const env = loadEnv();
const app = createApp(env, createDb(env.DATABASE_URL), createValidationQueue(env));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
	console.log(`api listening on http://localhost:${info.port}`);
});
