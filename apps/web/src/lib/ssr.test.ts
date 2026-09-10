import { describe, expect, it } from 'vitest';
import { headFetch } from './ssr';

describe('headFetch', () => {
	it('returns the data and leaves the status alone on success', async () => {
		const response = { status: 200 };
		const data = await headFetch(response, async () => ({ success: true, data: { name: 'x' } }));
		expect(data).toEqual({ name: 'x' });
		expect(response.status).toBe(200);
	});

	it('marks the response 404 when the API answered 404', async () => {
		const response = { status: 200 };
		const data = await headFetch(response, async () => ({ success: false, error: 'not found', status: 404 }));
		expect(data).toBeNull();
		expect(response.status).toBe(404);
	});

	it('keeps a 200 on an outage so the shell still serves', async () => {
		const response = { status: 200 };
		const data = await headFetch(response, async () => ({ success: false, error: 'cannot reach the API' }));
		expect(data).toBeNull();
		expect(response.status).toBe(200);
	});

	it('passes an abort signal to the call', async () => {
		let init: RequestInit | undefined;
		await headFetch({ status: 200 }, async (i) => {
			init = i;
			return { success: true, data: null };
		});
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});
});
