import { sourceError, type SourceResult } from './errors';

export interface RepoTarget {
	owner: string;
	repo: string;
	ref?: string;
	subpath?: string;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const REPO_RE = /^[\w.-]+$/;

// A subpath submission is a package rooted at that folder, so the folder names
// the package. Pack inference names multi-skill packs from this fallback; using
// the repo name there would collide every pack curated from the same monorepo.
export function packageNameFor(target: RepoTarget): string {
	if (!target.subpath) return target.repo;
	const segments = target.subpath.split('/');
	return segments[segments.length - 1];
}

const BAD_URL_HINT =
	'expected https://github.com/{owner}/{repo}, optionally with /tree/{branch}[/{subpath}]';

// Branch names containing "/" mis-split into ref + subpath here; resolving such a
// ref then 404s. Accepted v1 limitation - disambiguating requires extra API calls.
export function parseGithubUrl(input: string): SourceResult<RepoTarget> {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		return sourceError('bad-url', BAD_URL_HINT);
	}
	if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
		return sourceError('bad-url', BAD_URL_HINT);
	}

	let segments: string[];
	try {
		segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
	} catch {
		return sourceError('bad-url', BAD_URL_HINT);
	}

	const [owner, rawRepo, marker, ref, ...subpathSegments] = segments;
	const repo = rawRepo?.endsWith('.git') ? rawRepo.slice(0, -'.git'.length) : rawRepo;

	if (!owner || !repo || !OWNER_RE.test(owner) || !REPO_RE.test(repo)) {
		return sourceError('bad-url', BAD_URL_HINT);
	}
	if (segments.length === 2) {
		return { success: true, data: { owner, repo } };
	}
	if (marker !== 'tree' || !ref) {
		return sourceError('bad-url', BAD_URL_HINT);
	}
	if (subpathSegments.some((s) => s === '.' || s === '..')) {
		return sourceError('bad-url', 'subpath must not contain "." or ".." segments');
	}

	return {
		success: true,
		data: {
			owner,
			repo,
			ref,
			...(subpathSegments.length > 0 ? { subpath: subpathSegments.join('/') } : {}),
		},
	};
}
