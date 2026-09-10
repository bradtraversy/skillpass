import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runBackfill } from './runner';

vi.mock('../env', () => ({ loadEnv: () => ({ DATABASE_URL: 'postgres://test' }) }));
vi.mock('../db/client', () => ({ createDb: (url: string) => ({ url }) }));

const original = process.argv[1];
afterEach(() => {
	process.argv[1] = original;
});

describe('runBackfill', () => {
	it('does nothing when the module is merely imported', () => {
		const job = vi.fn();
		process.argv[1] = '/somewhere/else.ts';
		runBackfill(import.meta.url, job);
		expect(job).not.toHaveBeenCalled();
	});

	it('runs the job with the env and db when the module is the entry point', () => {
		const job = vi.fn().mockResolvedValue(undefined);
		process.argv[1] = fileURLToPath(import.meta.url);
		runBackfill(import.meta.url, job);
		expect(job).toHaveBeenCalledWith({ DATABASE_URL: 'postgres://test' }, { url: 'postgres://test' });
	});
});
