import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_API_URL, resolveApiUrl } from './api';

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
