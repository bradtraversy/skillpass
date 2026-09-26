// The repository reference grammar for `add`. The URL half mirrors the API's
// parseGithubUrl (apps/api/src/github/url.ts), which the CLI does not bundle.
export interface RepoTarget {
	owner: string;
	repo: string;
	ref?: string;
	subpath?: string;
}

export type RepoRefResult = { ok: true; target: RepoTarget } | { ok: false; message: string };

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const REPO_RE = /^[\w.-]+$/;
const SHORT_PREFIX = 'github:';

export const REPO_REF_HINT =
	'expected github:<owner>/<repo>[/<path>][@<ref>] or https://github.com/<owner>/<repo>[/tree/<ref>[/<path>]]';

// Anything shaped like a repo or a URL is a repo reference attempt, so a typo
// gets the grammar hint instead of "not published on the directory".
export function isRepoRef(ref: string): boolean {
	return ref.startsWith(SHORT_PREFIX) || /^https?:\/\//i.test(ref) || ref.startsWith('github.com/');
}

function invalid(ref: string, detail = REPO_REF_HINT): RepoRefResult {
	return { ok: false, message: `invalid repository reference "${ref}" (${detail})` };
}

function stripGit(repo: string): string {
	return repo.endsWith('.git') ? repo.slice(0, -'.git'.length) : repo;
}

function build(
	ref: string,
	owner: string,
	repo: string,
	gitRef: string | undefined,
	segments: string[],
): RepoRefResult {
	if (!OWNER_RE.test(owner) || !REPO_RE.test(repo)) {
		return invalid(ref);
	}
	if (segments.some((s) => s === '.' || s === '..')) {
		return invalid(ref, 'path must not contain "." or ".." segments');
	}
	return {
		ok: true,
		target: {
			owner,
			repo,
			...(gitRef !== undefined ? { ref: gitRef } : {}),
			...(segments.length > 0 ? { subpath: segments.join('/') } : {}),
		},
	};
}

function parseShort(ref: string): RepoRefResult {
	const body = ref.slice(SHORT_PREFIX.length);
	const at = body.lastIndexOf('@');
	const path = at === -1 ? body : body.slice(0, at);
	const gitRef = at === -1 ? undefined : body.slice(at + 1);
	if (gitRef === '') {
		return invalid(ref);
	}
	const [owner, repo, ...segments] = path.split('/').filter(Boolean);
	if (!owner || !repo) {
		return invalid(ref);
	}
	return build(ref, owner, stripGit(repo), gitRef, segments);
}

function parseUrl(ref: string): RepoRefResult {
	let url: URL;
	try {
		url = new URL(ref.trim());
	} catch {
		return invalid(ref);
	}
	if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
		return invalid(ref);
	}
	let segments: string[];
	try {
		segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
	} catch {
		return invalid(ref);
	}
	const [owner, rawRepo, marker, gitRef, ...rest] = segments;
	if (!owner || !rawRepo) {
		return invalid(ref);
	}
	if (segments.length === 2) {
		return build(ref, owner, stripGit(rawRepo), undefined, []);
	}
	if (marker !== 'tree' || !gitRef) {
		return invalid(ref);
	}
	return build(ref, owner, stripGit(rawRepo), gitRef, rest);
}

export function parseRepoRef(ref: string): RepoRefResult {
	if (ref.startsWith(SHORT_PREFIX)) {
		return parseShort(ref);
	}
	if (/^https?:\/\//i.test(ref)) {
		return parseUrl(ref);
	}
	return invalid(ref);
}

// A subpath names the package by its folder, the repo otherwise; the same rule
// the directory uses when it infers a manifest for a submission.
export function packageNameFor(target: RepoTarget): string {
	if (!target.subpath) return target.repo;
	const segments = target.subpath.split('/');
	return segments[segments.length - 1];
}
