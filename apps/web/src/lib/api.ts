import type {
	ApiEnvelope,
	PublicSkillDetail,
	PublicSkillSource,
	PublicSkillSummary,
	PublicSubmission,
	PublicValidation,
	PublishResult,
} from 'skill-schema';

// The only knob the static site needs to find the API.
export const API_URL: string = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:8787';

// The subset of the API's public user the submit island renders.
export interface CurrentUser {
	id: number;
	username: string;
	displayName: string;
	avatarUrl: string;
}

// The API's envelope, with the HTTP status attached to failures so islands
// can branch on it (404 vs outage) without matching error copy. A network
// failure has no response, so status stays undefined.
export type ApiResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; status?: number };

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
	let res: Response;
	try {
		res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init });
	} catch {
		return { success: false, error: 'cannot reach the API - is it running?' };
	}
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return {
			success: false,
			error: `unexpected response from the API (${res.status})`,
			status: res.status,
		};
	}
	if (typeof body === 'object' && body !== null && 'success' in body) {
		const envelope = body as ApiEnvelope<T>;
		return envelope.success ? envelope : { ...envelope, status: res.status };
	}
	return {
		success: false,
		error: `unexpected response from the API (${res.status})`,
		status: res.status,
	};
}

export function getMe(): Promise<ApiResult<CurrentUser>> {
	return request('/me');
}

export function getSkills(): Promise<ApiResult<PublicSkillSummary[]>> {
	return request('/skills');
}

export function getSkill(slug: string, version?: string): Promise<ApiResult<PublicSkillDetail>> {
	const base = `/skills/${encodeURIComponent(slug)}`;
	return request(version ? `${base}/${encodeURIComponent(version)}` : base);
}

export function getSkillSource(
	slug: string,
	version: string,
): Promise<ApiResult<PublicSkillSource>> {
	return request(`/skills/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/source`);
}

export function submitGithubUrl(githubUrl: string): Promise<ApiResult<PublicSubmission>> {
	return request('/submissions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ githubUrl }),
	});
}

export function submitZip(file: File): Promise<ApiResult<PublicSubmission>> {
	const form = new FormData();
	form.set('file', file);
	return request('/submissions/zip', { method: 'POST', body: form });
}

export function getValidation(id: number): Promise<ApiResult<PublicValidation>> {
	return request(`/submissions/${id}/validation`);
}

export function publishSubmission(id: number): Promise<ApiResult<PublishResult>> {
	return request(`/submissions/${id}/publish`, { method: 'POST' });
}

export function logout(): Promise<ApiResult<{ loggedOut: boolean }>> {
	return request('/auth/logout', { method: 'POST' });
}

export function signInUrl(): string {
	return `${API_URL}/auth/github`;
}
