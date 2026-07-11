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

	it('requires REDIS_URL in queue mode', () => {
		const { REDIS_URL: _redis, ...rest } = valid;
		expect(() => loadEnv({ ...rest, VALIDATION_MODE: 'queue' })).toThrow();
	});

	it('allows a missing REDIS_URL in inline mode', () => {
		const { REDIS_URL: _redis, ...rest } = valid;
		const env = loadEnv({ ...rest, VALIDATION_MODE: 'inline' });
		expect(env.VALIDATION_MODE).toBe('inline');
		expect(env.REDIS_URL).toBeUndefined();
	});

	it('defaults VALIDATION_MODE to inline', () => {
		const { REDIS_URL: _redis, VALIDATION_MODE: _mode, ...rest } = valid;
		expect(loadEnv(rest).VALIDATION_MODE).toBe('inline');
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
