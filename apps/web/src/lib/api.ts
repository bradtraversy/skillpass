import type {
	AdminAbuseReport,
	AdminQueue,
	AdminVersionHistory,
	ApiEnvelope,
	CreatedSubmission,
	MaintainerReport,
	MaintainerSkill,
	PublicAbuseReport,
	PublicPreflight,
	PublicProfile,
	PublicSkillDetail,
	PublicSkillSource,
	PublicSkillSummary,
	PublicSubmission,
	PublicUser,
	PublicValidation,
	PublishResult,
	SkillStatus,
} from 'skill-schema';

// The only knob the static site needs to find the API.
export const API_URL: string = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:8787';

// The API's envelope, with the HTTP status attached to failures so islands
// can branch on it (404 vs outage) without matching error copy. A network
// failure has no response, so status stays undefined.
export type ApiResult<T> = { success: true; data: T } | { success: false; error: string; status?: number };

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

export function getMe(): Promise<ApiResult<PublicUser>> {
	return request('/me');
}

export function getSkills(init?: RequestInit): Promise<ApiResult<PublicSkillSummary[]>> {
	return request('/skills', init);
}

// AI semantic search; rows arrive in relevance order and must not be re-sorted.
export function searchSkills(q: string): Promise<ApiResult<PublicSkillSummary[]>> {
	return request(`/skills/search?q=${encodeURIComponent(q)}`);
}

export function getSkill(slug: string, version?: string, init?: RequestInit): Promise<ApiResult<PublicSkillDetail>> {
	const base = `/skills/${encodeURIComponent(slug)}`;
	return request(version ? `${base}/${encodeURIComponent(version)}` : base, init);
}

export function getSkillSource(slug: string, version: string): Promise<ApiResult<PublicSkillSource>> {
	return request(`/skills/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/source`);
}

export function getProfile(username: string, init?: RequestInit): Promise<ApiResult<PublicProfile>> {
	return request(`/users/${encodeURIComponent(username)}`, init);
}

export function getMySkills(): Promise<ApiResult<MaintainerSkill[]>> {
	return request('/me/skills');
}

export function getMyReports(): Promise<ApiResult<MaintainerReport[]>> {
	return request('/me/reports');
}

export function getMySubmissions(): Promise<ApiResult<PublicSubmission[]>> {
	return request('/submissions');
}

export function unlistSkill(slug: string): Promise<ApiResult<{ slug: string; status: SkillStatus }>> {
	return request(`/skills/${encodeURIComponent(slug)}/unlist`, { method: 'POST' });
}

export function relistSkill(slug: string): Promise<ApiResult<{ slug: string; status: SkillStatus }>> {
	return request(`/skills/${encodeURIComponent(slug)}/relist`, { method: 'POST' });
}

export function getPreflight(slug: string, version: string): Promise<ApiResult<PublicPreflight>> {
	return request(`/skills/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/preflight`);
}

// A plain href - the browser handles the zip attachment itself.
export function downloadUrl(slug: string, version: string): string {
	return `${API_URL}/skills/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/download`;
}

export function submitGithubUrl(githubUrl: string): Promise<ApiResult<CreatedSubmission>> {
	return request('/submissions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ githubUrl }),
	});
}

export function submitZip(file: File): Promise<ApiResult<CreatedSubmission>> {
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

export function reportSkill(slug: string, reason: string): Promise<ApiResult<PublicAbuseReport>> {
	return request(`/skills/${encodeURIComponent(slug)}/report`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ reason }),
	});
}

export function getAdminQueue(): Promise<ApiResult<AdminQueue>> {
	return request('/admin/queue');
}

export function getSkillHistory(slug: string): Promise<ApiResult<AdminVersionHistory[]>> {
	return request(`/admin/skills/${encodeURIComponent(slug)}/history`);
}

export function resolveReport(id: number, status: 'reviewed' | 'actioned'): Promise<ApiResult<AdminAbuseReport>> {
	return request(`/admin/reports/${id}/resolve`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status }),
	});
}

export function flagSkill(slug: string): Promise<ApiResult<{ slug: string; status: string }>> {
	return request(`/admin/skills/${encodeURIComponent(slug)}/flag`, { method: 'POST' });
}

export function unflagSkill(slug: string): Promise<ApiResult<{ slug: string; status: string }>> {
	return request(`/admin/skills/${encodeURIComponent(slug)}/unflag`, { method: 'POST' });
}

export function setFeatured(slug: string, value: boolean): Promise<ApiResult<{ slug: string; featured: boolean }>> {
	return request(`/admin/skills/${encodeURIComponent(slug)}/feature`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ value }),
	});
}

export function setVerified(slug: string, value: boolean): Promise<ApiResult<{ slug: string; verified: boolean }>> {
	return request(`/admin/skills/${encodeURIComponent(slug)}/verify`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ value }),
	});
}

export function logout(): Promise<ApiResult<{ loggedOut: boolean }>> {
	return request('/auth/logout', { method: 'POST' });
}

export function signInUrl(): string {
	return `${API_URL}/auth/github`;
}
