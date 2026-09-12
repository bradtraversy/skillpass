import type { Context, Env, Next } from 'hono';

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

function prune(windows: Map<string, { start: number; count: number }>, now: number, windowMs: number): void {
	for (const [key, window] of windows) {
		if (now - window.start >= windowMs) windows.delete(key);
	}
}

// Render sits behind Cloudflare, which supplies the real client address as
// cf-connecting-ip and appends it as the last x-forwarded-for hop; the first
// hop is whatever the caller sent, so it must never be the key. Clients with
// no usable header share a bucket rather than bypassing the limit.
export function clientKey(header: (name: string) => string | undefined): string {
	const edge = header('cf-connecting-ip')?.trim() || header('true-client-ip')?.trim();
	if (edge) return edge;
	const hops = (header('x-forwarded-for') ?? '')
		.split(',')
		.map((hop) => hop.trim())
		.filter(Boolean);
	return hops.at(-1) ?? 'unknown';
}

// Buckets by client address unless the caller supplies a key (a user id for
// authenticated routes, where the address is the wrong unit).
export function rateLimitMiddleware<E extends Env = Env>(
	limiter: RateLimiter,
	keyOf: (c: Context<E>) => string = (c) => clientKey((name) => c.req.header(name)),
) {
	return async (c: Context<E>, next: Next) => {
		if (!limiter.allow(keyOf(c))) {
			return c.json({ success: false, error: 'Too many requests, slow down.' }, 429);
		}
		await next();
	};
}
