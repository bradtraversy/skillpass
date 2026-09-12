import type { Context, MiddlewareHandler } from 'hono';
import { getSignedCookie } from 'hono/cookie';
import type { Db } from '../db/client';
import { findById } from '../db/users';
import type { UserRow } from '../db/schema';
import type { Env } from '../env';

export const SESSION_COOKIE = 'skillpass_session';

export type AuthVariables = { user: UserRow };

export function requireAuth(env: Env, db: Db): MiddlewareHandler<{ Variables: AuthVariables }> {
	return async (c, next) => {
		// getSignedCookie yields false for a bad signature, undefined for absent
		const value = await getSignedCookie(c, env.SESSION_SECRET, SESSION_COOKIE);
		if (typeof value !== 'string') {
			return c.json({ success: false, error: 'unauthorized' }, 401);
		}
		const id = Number(value);
		if (!Number.isInteger(id)) {
			return c.json({ success: false, error: 'unauthorized' }, 401);
		}
		const user = await findById(db, id);
		if (!user) {
			return c.json({ success: false, error: 'unauthorized' }, 401);
		}
		c.set('user', user);
		await next();
	};
}

// Role gate for admin surfaces. Reads the user requireAuth already resolved, so
// it must be mounted after requireAuth: an anon 401s there before this runs, a
// signed-in non-match 403s here.
export function requireRole(role: UserRow['role']): MiddlewareHandler<{ Variables: AuthVariables }> {
	return async (c, next) => {
		const user = c.get('user');
		if (!user || user.role !== role) {
			return c.json({ success: false, error: 'forbidden' }, 403);
		}
		await next();
	};
}

// Optional read for anonymous routes that attribute when they can: a valid
// session yields the user id, anything else yields null - never a 401.
export async function readSessionUserId(c: Context, env: Env): Promise<number | null> {
	const value = await getSignedCookie(c, env.SESSION_SECRET, SESSION_COOKIE);
	if (typeof value !== 'string') {
		return null;
	}
	const id = Number(value);
	return Number.isInteger(id) ? id : null;
}
