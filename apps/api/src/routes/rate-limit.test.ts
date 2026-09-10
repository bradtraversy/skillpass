import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { clientKey, createRateLimiter, rateLimitMiddleware } from './rate-limit';

describe('createRateLimiter', () => {
	it('allows up to the max within a window, then denies', () => {
		const limiter = createRateLimiter(3, 60_000);
		expect(limiter.allow('a', 0)).toBe(true);
		expect(limiter.allow('a', 1)).toBe(true);
		expect(limiter.allow('a', 2)).toBe(true);
		expect(limiter.allow('a', 3)).toBe(false);
	});

	it('resets when the window rolls', () => {
		const limiter = createRateLimiter(1, 60_000);
		expect(limiter.allow('a', 0)).toBe(true);
		expect(limiter.allow('a', 59_999)).toBe(false);
		expect(limiter.allow('a', 60_000)).toBe(true);
	});

	it('isolates keys', () => {
		const limiter = createRateLimiter(1, 60_000);
		expect(limiter.allow('a', 0)).toBe(true);
		expect(limiter.allow('b', 0)).toBe(true);
		expect(limiter.allow('a', 1)).toBe(false);
	});

	it('prunes stale keys when a new one arrives after the window', () => {
		const limiter = createRateLimiter(1, 60_000);
		limiter.allow('a', 0);
		// New key after 'a' expired: 'a' is pruned, so its next call starts fresh.
		expect(limiter.allow('b', 61_000)).toBe(true);
		expect(limiter.allow('a', 61_001)).toBe(true);
	});
});

describe('clientKey', () => {
	const headers = (map: Record<string, string>) => (name: string) => map[name];

	it('prefers the address Cloudflare attaches over anything the caller sent', () => {
		expect(
			clientKey(headers({ 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '203.0.113.5, 198.51.100.7' })),
		).toBe('198.51.100.7');
		expect(clientKey(headers({ 'true-client-ip': '198.51.100.8' }))).toBe('198.51.100.8');
	});

	it('falls back to the last x-forwarded-for hop, never the spoofable first one', () => {
		expect(clientKey(headers({ 'x-forwarded-for': '203.0.113.5, 198.51.100.7' }))).toBe('198.51.100.7');
	});

	it('falls back to a shared bucket without a usable header', () => {
		expect(clientKey(headers({}))).toBe('unknown');
		expect(clientKey(headers({ 'x-forwarded-for': ' , ' }))).toBe('unknown');
	});
});

describe('rateLimitMiddleware', () => {
	it('buckets by the supplied key instead of the client address', async () => {
		const app = new Hono();
		app.use('*', rateLimitMiddleware(createRateLimiter(1, 60_000), (c) => c.req.header('x-user') ?? 'anon'));
		app.get('/', (c) => c.text('ok'));
		expect((await app.request('/', { headers: { 'x-user': 'a' } })).status).toBe(200);
		expect((await app.request('/', { headers: { 'x-user': 'a' } })).status).toBe(429);
		expect((await app.request('/', { headers: { 'x-user': 'b' } })).status).toBe(200);
	});
});
