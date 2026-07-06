import type { Env } from '../env';

export interface RedisConnection {
	url: string;
	maxRetriesPerRequest: null;
	enableOfflineQueue?: boolean;
}

// BullMQ builds its own ioredis clients from these; maxRetriesPerRequest: null
// is required by BullMQ, and TLS comes from a rediss:// URL, so this stays
// provider-neutral behind REDIS_URL.
export function redisConnection(
	env: Env,
	overrides: { enableOfflineQueue?: boolean } = {},
): RedisConnection {
	return { url: env.REDIS_URL, maxRetriesPerRequest: null, ...overrides };
}
