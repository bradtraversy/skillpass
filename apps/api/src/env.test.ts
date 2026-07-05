import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const valid = {
	DATABASE_URL: 'postgres://user:pass@host/db',
	GITHUB_CLIENT_ID: 'abc',
	GITHUB_CLIENT_SECRET: 'def',
	SESSION_SECRET: 'x'.repeat(32),
};

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

	it('rejects a short SESSION_SECRET', () => {
		expect(() => loadEnv({ ...valid, SESSION_SECRET: 'short' })).toThrow();
	});

	it('rejects a non-URL WEB_ORIGIN', () => {
		expect(() => loadEnv({ ...valid, WEB_ORIGIN: 'not a url' })).toThrow();
	});
});
