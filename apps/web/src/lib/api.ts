import type { ApiEnvelope, PublicSubmission } from 'skill-schema';

// The only knob the static site needs to find the API.
export const API_URL: string = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:8787';

// The subset of the API's public user the submit island renders.
export interface CurrentUser {
	id: number;
	username: string;
	displayName: string;
	avatarUrl: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
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
		return { success: false, error: `unexpected response from the API (${res.status})` };
	}
	if (typeof body === 'object' && body !== null && 'success' in body) {
		return body as ApiEnvelope<T>;
	}
	return { success: false, error: `unexpected response from the API (${res.status})` };
}

export function getMe(): Promise<ApiEnvelope<CurrentUser>> {
	return request('/me');
}

export function submitGithubUrl(githubUrl: string): Promise<ApiEnvelope<PublicSubmission>> {
	return request('/submissions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ githubUrl }),
	});
}

export function submitZip(file: File): Promise<ApiEnvelope<PublicSubmission>> {
	const form = new FormData();
	form.set('file', file);
	return request('/submissions/zip', { method: 'POST', body: form });
}

export function logout(): Promise<ApiEnvelope<{ loggedOut: boolean }>> {
	return request('/auth/logout', { method: 'POST' });
}

export function signInUrl(): string {
	return `${API_URL}/auth/github`;
}
