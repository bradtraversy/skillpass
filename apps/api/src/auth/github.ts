import { z } from 'zod';
import type { GithubProfile } from '../db/users';
import { USER_AGENT } from '../lib/http';
import type { Result } from '../lib/result';

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';

export function buildAuthorizeUrl(clientId: string, state: string): string {
	const url = new URL(AUTHORIZE_URL);
	url.searchParams.set('client_id', clientId);
	url.searchParams.set('state', state);
	return url.toString();
}

// GitHub answers 200 even for bad codes, with { error } instead of a token.
const tokenResponseSchema = z.looseObject({ access_token: z.string().min(1).optional() });

export async function exchangeCode(
	code: string,
	clientId: string,
	clientSecret: string,
): Promise<Result<string>> {
	try {
		const res = await fetch(TOKEN_URL, {
			method: 'POST',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
		});
		if (!res.ok) {
			return { success: false, error: `token exchange failed (${res.status})` };
		}
		const parsed = tokenResponseSchema.safeParse(await res.json());
		if (!parsed.success || parsed.data.access_token === undefined) {
			return { success: false, error: 'no access token in exchange response' };
		}
		return { success: true, data: parsed.data.access_token };
	} catch (err) {
		return { success: false, error: `token exchange errored: ${(err as Error).message}` };
	}
}

const githubUserSchema = z.looseObject({
	id: z.number(),
	login: z.string().min(1),
	name: z.string().nullish(),
	avatar_url: z.string(),
});

export async function fetchGithubUser(accessToken: string): Promise<Result<GithubProfile>> {
	try {
		const res = await fetch(USER_URL, {
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${accessToken}`,
				'User-Agent': USER_AGENT,
			},
		});
		if (!res.ok) {
			return { success: false, error: `github user fetch failed (${res.status})` };
		}
		const parsed = githubUserSchema.safeParse(await res.json());
		if (!parsed.success) {
			return { success: false, error: 'unexpected github user response shape' };
		}
		const u = parsed.data;
		return {
			success: true,
			data: {
				githubId: String(u.id),
				username: u.login,
				displayName: u.name ?? u.login,
				avatarUrl: u.avatar_url,
			},
		};
	} catch (err) {
		return { success: false, error: `github user fetch errored: ${(err as Error).message}` };
	}
}
