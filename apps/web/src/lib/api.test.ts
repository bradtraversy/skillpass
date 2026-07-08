import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL, getMe, submitGithubUrl, submitZip } from './api';

function mockFetch(response: { status?: number; json?: unknown; text?: string; reject?: Error }) {
	const fn = vi.fn().mockImplementation(() => {
		if (response.reject) return Promise.reject(response.reject);
		const status = response.status ?? 200;
		if (response.text !== undefined) {
			return Promise.resolve(new Response(response.text, { status }));
		}
		return Promise.resolve(
			new Response(JSON.stringify(response.json), {
				status,
				headers: { 'Content-Type': 'application/json' },
			}),
		);
	});
	vi.stubGlobal('fetch', fn);
	return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('getMe', () => {
	it('passes the envelope through with credentials', async () => {
		const fn = mockFetch({ json: { success: true, data: { id: 1, username: 'brad' } } });
		const result = await getMe();
		expect(result).toEqual({ success: true, data: { id: 1, username: 'brad' } });
		const [url, init] = fn.mock.calls[0];
		expect(url).toBe(`${API_URL}/me`);
		expect(init.credentials).toBe('include');
	});

	it('attaches the HTTP status to API error envelopes', async () => {
		mockFetch({ status: 401, json: { success: false, error: 'unauthorized' } });
		expect(await getMe()).toEqual({ success: false, error: 'unauthorized', status: 401 });
	});
});

describe('submitGithubUrl', () => {
	it('POSTs JSON to /submissions', async () => {
		const fn = mockFetch({ status: 201, json: { success: true, data: { id: 9 } } });
		const result = await submitGithubUrl('https://github.com/octocat/hello');
		expect(result).toEqual({ success: true, data: { id: 9 } });
		const [url, init] = fn.mock.calls[0];
		expect(url).toBe(`${API_URL}/submissions`);
		expect(init.method).toBe('POST');
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(JSON.parse(init.body)).toEqual({ githubUrl: 'https://github.com/octocat/hello' });
	});
});

describe('submitZip', () => {
	it('POSTs multipart with the file field', async () => {
		const fn = mockFetch({ status: 201, json: { success: true, data: { id: 10 } } });
		const file = new File([new Uint8Array([80, 75])], 'demo.zip');
		const result = await submitZip(file);
		expect(result).toEqual({ success: true, data: { id: 10 } });
		const [url, init] = fn.mock.calls[0];
		expect(url).toBe(`${API_URL}/submissions/zip`);
		expect(init.body).toBeInstanceOf(FormData);
		expect(init.body.get('file')).toBe(file);
	});
});

describe('request failure mapping', () => {
	it('maps a network failure to a friendly envelope with no status', async () => {
		mockFetch({ reject: new Error('ECONNREFUSED') });
		expect(await getMe()).toEqual({ success: false, error: 'cannot reach the API - is it running?' });
	});

	it('maps a non-JSON response to an envelope with the status', async () => {
		mockFetch({ status: 502, text: 'Bad Gateway' });
		expect(await getMe()).toEqual({
			success: false,
			error: 'unexpected response from the API (502)',
			status: 502,
		});
	});

	it('maps a JSON response without the envelope shape to an error', async () => {
		mockFetch({ status: 200, json: { hello: 'world' } });
		expect(await getMe()).toEqual({
			success: false,
			error: 'unexpected response from the API (200)',
			status: 200,
		});
	});
});
