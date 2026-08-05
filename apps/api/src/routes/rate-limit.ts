import type { Context, Next } from 'hono';

// Fixed-window in-memory limiter. Honest for a single API instance (today's
// Render footprint); swap for a shared store before scaling out.
export interface RateLimiter {
	allow(key: string, now?: number): boolean;
}

export function createRateLimiter(maxPerWindow: number, windowMs: number): RateLimiter {
	const windows = new Map<string, { start: number; count: number }>();
	return {
		allow(key: string, now: number = Date.now()): boolean {
			const current = windows.get(key);
			if (!current || now - current.start >= windowMs) {
				// A rolled window is also the moment to drop other stale keys, so
				// the map never grows unbounded across many one-off clients.
				if (!current) prune(windows, now, windowMs);
				windows.set(key, { start: now, count: 1 });
				return true;
			}
			if (current.count >= maxPerWindow) return false;
			current.count++;
			return true;
		},
	};
}

function prune(
	windows: Map<string, { start: number; count: number }>,
	now: number,
	windowMs: number,
): void {
	for (const [key, window] of windows) {
		if (now - window.start >= windowMs) windows.delete(key);
	}
}

// First hop of x-forwarded-for (Render terminates TLS in front of the API);
// clients without one share a bucket rather than bypassing the limit.
export function clientKey(header: string | undefined): string {
	const first = header?.split(',')[0]?.trim();
	return first || 'unknown';
}

export function rateLimitMiddleware(limiter: RateLimiter) {
	return async (c: Context, next: Next) => {
		const key = clientKey(c.req.header('x-forwarded-for'));
		if (!limiter.allow(key)) {
			return c.json({ success: false, error: 'Too many requests, slow down.' }, 429);
		}
		await next();
	};
}
