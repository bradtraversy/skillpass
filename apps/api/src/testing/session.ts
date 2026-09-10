import { Hono } from 'hono';
import { setSignedCookie } from 'hono/cookie';
import { SESSION_COOKIE } from '../auth/middleware';

// A signed session cookie for a user id, minted the way the auth callback does.
export async function sessionCookie(id: number, secret: string): Promise<string> {
	const signer = new Hono();
	signer.get('/', async (c) => {
		await setSignedCookie(c, SESSION_COOKIE, String(id), secret);
		return c.text('ok');
	});
	const res = await signer.request('/');
	return res.headers.getSetCookie()[0].split(';')[0];
}
