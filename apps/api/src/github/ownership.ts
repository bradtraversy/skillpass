import type { UserRow } from '../db/schema';
import type { Env } from '../env';
import { sourceError, type SourceResult } from './errors';
import { GITHUB_TIMEOUT_MS, githubHeaders } from './pin';
import type { RepoTarget } from './url';

// Admins curate third-party listings; everyone else submits repos they own or
// org repos where their membership is public. Private org membership is not
// checkable without a user OAuth token, which we deliberately never store.
export async function verifySubmitPermission(env: Env, user: UserRow, target: RepoTarget): Promise<SourceResult<null>> {
	if (user.role === 'admin') {
		return { success: true, data: null };
	}
	if (target.owner.toLowerCase() === user.username.toLowerCase()) {
		return { success: true, data: null };
	}

	const url = `https://api.github.com/orgs/${target.owner}/public_members/${encodeURIComponent(user.username)}`;
	let res: Response;
	try {
		res = await fetch(url, {
			headers: githubHeaders(env),
			signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
		});
	} catch (err) {
		return sourceError('upstream', `github membership check errored: ${(err as Error).message}`);
	}

	if (res.status === 204) {
		return { success: true, data: null };
	}
	if (res.status === 404) {
		return sourceError(
			'forbidden',
			'you can only submit repositories you own, or org repositories where your membership is public',
		);
	}
	if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) {
		return sourceError('rate-limited', 'github rate limit hit; try again shortly');
	}
	return sourceError('upstream', `github membership check failed (${res.status})`);
}
