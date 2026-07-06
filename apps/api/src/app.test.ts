import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import type { Db } from './db/client';
import { loadEnv } from './env';
import { RAW_TEST_ENV } from './testing/env';

const env = loadEnv(RAW_TEST_ENV);

describe('GET /health', () => {
	it('responds ok', async () => {
		const res = await createApp(env, {} as Db).request('/health');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true, data: { status: 'ok' } });
	});
});
