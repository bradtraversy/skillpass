import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../env';
import { RAW_TEST_ENV } from '../testing/env';
import { putBytes, putJson, snapshotKey, uploadKey } from './r2';

const env = loadEnv(RAW_TEST_ENV);

afterEach(() => vi.unstubAllGlobals());

describe('snapshotKey', () => {
	it('builds a content-addressed key from the source hash', () => {
		expect(snapshotKey('sha256:abc123')).toBe('snapshots/abc123.json');
	});
});

describe('uploadKey', () => {
	it('builds a content-addressed zip key', () => {
		expect(uploadKey('def456')).toBe('uploads/def456.zip');
	});
});

describe('putBytes', () => {
	it('PUTs signed binary with the given content type', async () => {
		const fn = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fn);

		const bytes = new Uint8Array([80, 75, 3, 4]);
		const result = await putBytes(env, 'uploads/def456.zip', bytes, 'application/zip');
		expect(result).toEqual({ success: true, data: null });

		const req = fn.mock.calls[0][0] as Request;
		expect(req.url).toBe('https://acct.r2.cloudflarestorage.com/test-bucket/uploads/def456.zip');
		expect(req.method).toBe('PUT');
		expect(req.headers.get('content-type')).toBe('application/zip');
		expect(req.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256/);
		expect(new Uint8Array(await req.arrayBuffer())).toEqual(bytes);
	});

	it('maps a non-2xx to an error result', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('denied', { status: 403 })));
		const result = await putBytes(env, 'k', new Uint8Array([1]), 'application/zip');
		expect(result).toEqual({ success: false, error: 'r2 put failed (403)' });
	});
});

describe('putJson', () => {
	it('PUTs signed JSON to the bucket object', async () => {
		const fn = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fn);

		const result = await putJson(env, 'snapshots/abc.json', { version: 1 });
		expect(result).toEqual({ success: true, data: null });

		const req = fn.mock.calls[0][0] as Request;
		expect(req.url).toBe('https://acct.r2.cloudflarestorage.com/test-bucket/snapshots/abc.json');
		expect(req.method).toBe('PUT');
		expect(req.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256/);
		expect(await req.text()).toBe('{"version":1}');
	});

	it('maps a non-2xx to an error result', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('denied', { status: 403 })));
		const result = await putJson(env, 'k', {});
		expect(result).toEqual({ success: false, error: 'r2 put failed (403)' });
	});

	it('maps a network failure to an error result', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		const result = await putJson(env, 'k', {});
		expect(result).toMatchObject({ success: false });
	});
});
