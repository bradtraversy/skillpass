import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { createValidationQueue } from './queue/queue';

const env = loadEnv();
// Only queue mode needs a live Redis connection; inline mode validates in-process.
const queue = env.VALIDATION_MODE === 'queue' ? createValidationQueue(env) : null;
const app = createApp(env, createDb(env.DATABASE_URL), queue);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
	console.log(`api listening on http://localhost:${info.port}`);
});
