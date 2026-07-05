import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';

const env = loadEnv();
const app = createApp(env, createDb(env.DATABASE_URL));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
	console.log(`api listening on http://localhost:${info.port}`);
});
