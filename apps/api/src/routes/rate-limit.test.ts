import { describe, expect, it } from 'vitest';
import { clientKey, createRateLimiter } from './rate-limit';

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
	it('takes the first hop of x-forwarded-for', () => {
		expect(clientKey('203.0.113.5, 10.0.0.1')).toBe('203.0.113.5');
	});

	it('falls back to a shared bucket without the header', () => {
		expect(clientKey(undefined)).toBe('unknown');
		expect(clientKey('  ')).toBe('unknown');
	});
});
