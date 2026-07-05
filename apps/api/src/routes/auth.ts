import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie, setSignedCookie } from 'hono/cookie';
import { buildAuthorizeUrl, exchangeCode, fetchGithubUser } from '../auth/github';
import { SESSION_COOKIE } from '../auth/middleware';
import type { Db } from '../db/client';
import { upsertFromGithub } from '../db/users';
import type { Env } from '../env';

const STATE_COOKIE = 'oauth_state';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function authRoutes(env: Env, db: Db) {
	const secure = env.WEB_ORIGIN.startsWith('https');
	const routes = new Hono();

	routes.get('/github', (c) => {
		const state = crypto.randomUUID();
		setCookie(c, STATE_COOKIE, state, {
			httpOnly: true,
			sameSite: 'Lax',
			path: '/',
			maxAge: 600,
			secure,
		});
		return c.redirect(buildAuthorizeUrl(env.GITHUB_CLIENT_ID, state));
	});

	routes.get('/github/callback', async (c) => {
		const { code, state, error } = c.req.query();
		const stateCookie = getCookie(c, STATE_COOKIE);
		deleteCookie(c, STATE_COOKIE, { path: '/' });

		const failed = `${env.WEB_ORIGIN}/?auth=failed`;
		if (error !== undefined || code === undefined) {
			return c.redirect(failed);
		}
		if (state === undefined || stateCookie === undefined || state !== stateCookie) {
			return c.json({ success: false, error: 'invalid oauth state' }, 403);
		}

		const token = await exchangeCode(code, env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);
		if (!token.success) {
			return c.redirect(failed);
		}
		const profile = await fetchGithubUser(token.data);
		if (!profile.success) {
			return c.redirect(failed);
		}

		const user = await upsertFromGithub(db, profile.data);
		await setSignedCookie(c, SESSION_COOKIE, String(user.id), env.SESSION_SECRET, {
			httpOnly: true,
			sameSite: 'Lax',
			path: '/',
			maxAge: SESSION_MAX_AGE,
			secure,
		});
		return c.redirect(env.WEB_ORIGIN);
	});

	routes.post('/logout', (c) => {
		deleteCookie(c, SESSION_COOKIE, { path: '/' });
		return c.json({ success: true, data: { loggedOut: true } });
	});

	return routes;
}
