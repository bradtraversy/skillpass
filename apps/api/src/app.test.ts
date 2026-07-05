import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import type { Db } from './db/client';
import { loadEnv } from './env';

const env = loadEnv({
	DATABASE_URL: 'postgres://unused',
	GITHUB_CLIENT_ID: 'abc',
	GITHUB_CLIENT_SECRET: 'def',
	SESSION_SECRET: 'x'.repeat(32),
});

describe('GET /health', () => {
	it('responds ok', async () => {
		const res = await createApp(env, {} as Db).request('/health');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true, data: { status: 'ok' } });
	});
});
