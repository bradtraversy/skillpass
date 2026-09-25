import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_API_URL, getParsed, resolveApiUrl } from './api';

const saved = process.env.SKILLPASS_API;

afterEach(() => {
	if (saved === undefined) {
		delete process.env.SKILLPASS_API;
	} else {
		process.env.SKILLPASS_API = saved;
	}
});

describe('resolveApiUrl', () => {
	it('defaults to the production API', () => {
		delete process.env.SKILLPASS_API;
		expect(resolveApiUrl()).toBe('https://api.skillpass.dev');
		expect(DEFAULT_API_URL).toBe('https://api.skillpass.dev');
	});

	it('lets SKILLPASS_API point elsewhere, trimming a trailing slash', () => {
		process.env.SKILLPASS_API = 'http://localhost:8787/';
		expect(resolveApiUrl()).toBe('http://localhost:8787');
	});

	it('treats an empty SKILLPASS_API as unset', () => {
		process.env.SKILLPASS_API = '';
		expect(resolveApiUrl()).toBe('https://api.skillpass.dev');
	});

	it('prefers an explicit override over the environment', () => {
		process.env.SKILLPASS_API = 'http://localhost:8787';
		expect(resolveApiUrl('https://example.com')).toBe('https://example.com');
	});
});

describe('getParsed', () => {
	const schema = { safeParse: (input: unknown) => ({ success: true as const, data: input }) };
	const reply = (status: number, body: unknown) =>
		vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

	it('carries the status and the API error text on a failed answer', async () => {
		const outcome = await getParsed(
			reply(429, { success: false, error: 'Too many requests, slow down.' }),
			'u',
			schema,
		);
		expect(outcome).toEqual({
			ok: false,
			notFound: false,
			message: 'the API returned an error (429)',
			status: 429,
			apiError: 'Too many requests, slow down.',
		});
	});

	it('marks 404 as not found with its status', async () => {
		const outcome = await getParsed(reply(404, { success: false, error: 'nope' }), 'u', schema);
		expect(outcome.ok).toBe(false);
		expect(!outcome.ok && outcome.notFound).toBe(true);
		expect(!outcome.ok && outcome.status).toBe(404);
	});

	it('has no status when the API could not be reached', async () => {
		const down = vi.fn(async () => {
			throw new Error('offline');
		}) as unknown as typeof fetch;
		const outcome = await getParsed(down, 'u', schema);
		expect(outcome.ok).toBe(false);
		expect(!outcome.ok && outcome.status).toBeUndefined();
		expect(!outcome.ok && outcome.message).toContain('cannot reach the API');
	});
});
