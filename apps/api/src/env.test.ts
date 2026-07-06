import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';
import { RAW_TEST_ENV } from './testing/env';

const valid = RAW_TEST_ENV;

describe('loadEnv', () => {
	it('parses a valid source and applies defaults', () => {
		const env = loadEnv(valid);
		expect(env.PORT).toBe(8787);
		expect(env.WEB_ORIGIN).toBe('http://localhost:4321');
	});

	it('coerces PORT from a string', () => {
		expect(loadEnv({ ...valid, PORT: '3001' }).PORT).toBe(3001);
	});

	it('rejects a missing required var', () => {
		const { DATABASE_URL: _url, ...rest } = valid;
		expect(() => loadEnv(rest)).toThrow();
	});

	it('rejects a missing R2 var', () => {
		const { R2_BUCKET: _bucket, ...rest } = valid;
		expect(() => loadEnv(rest)).toThrow();
	});

	it('rejects a missing REDIS_URL', () => {
		const { REDIS_URL: _redis, ...rest } = valid;
		expect(() => loadEnv(rest)).toThrow();
	});

	it('accepts an optional GITHUB_TOKEN', () => {
		expect(loadEnv(valid).GITHUB_TOKEN).toBeUndefined();
		expect(loadEnv({ ...valid, GITHUB_TOKEN: 'ghp_x' }).GITHUB_TOKEN).toBe('ghp_x');
	});

	it('rejects a short SESSION_SECRET', () => {
		expect(() => loadEnv({ ...valid, SESSION_SECRET: 'short' })).toThrow();
	});

	it('rejects a non-URL WEB_ORIGIN', () => {
		expect(() => loadEnv({ ...valid, WEB_ORIGIN: 'not a url' })).toThrow();
	});
});
