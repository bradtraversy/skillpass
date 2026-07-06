import { z } from 'zod';
import type { Env } from '../env';
import { USER_AGENT } from '../lib/http';
import { sourceError, type SourceResult } from './errors';
import type { RepoTarget } from './url';

export const GITHUB_TIMEOUT_MS = 30_000;

export function githubHeaders(env: Env): Record<string, string> {
	return {
		Accept: 'application/vnd.github+json',
		'User-Agent': USER_AGENT,
		...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
	};
}

const commitSchema = z.looseObject({ sha: z.string().min(1) });

// Pins a target to a full commit sha; HEAD resolves the default branch, so a
// plain repo URL needs no extra default-branch lookup.
export async function resolveCommit(env: Env, target: RepoTarget): Promise<SourceResult<string>> {
	const ref = target.ref ?? 'HEAD';
	const url = `https://api.github.com/repos/${target.owner}/${target.repo}/commits/${encodeURIComponent(ref)}`;

	let res: Response;
	try {
		res = await fetch(url, {
			headers: githubHeaders(env),
			signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
		});
	} catch (err) {
		return sourceError('upstream', `github commit lookup errored: ${(err as Error).message}`);
	}

	if (res.status === 404) {
		return sourceError('not-found', 'repository or ref not found, or the repository is private');
	}
	// A 403 is only rate limiting when the quota is actually exhausted; other
	// 403s (SAML-gated org, blocked token) fall through to the upstream message.
	if (
		res.status === 429 ||
		(res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')
	) {
		return sourceError('rate-limited', 'github rate limit hit; try again shortly');
	}
	if (!res.ok) {
		return sourceError('upstream', `github commit lookup failed (${res.status})`);
	}

	const parsed = commitSchema.safeParse(await res.json());
	if (!parsed.success) {
		return sourceError('upstream', 'unexpected github commit response shape');
	}
	return { success: true, data: parsed.data.sha };
}
