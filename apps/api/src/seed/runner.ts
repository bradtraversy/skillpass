import { fileURLToPath } from 'node:url';
import { createDb, type Db } from '../db/client';
import { loadEnv, type Env } from '../env';

// Runs a backfill only when its file is the process entry point, so a test can
// import a helper from the script without starting a database pass.
export function runBackfill(moduleUrl: string, job: (env: Env, db: Db) => Promise<void>): void {
	if (process.argv[1] !== fileURLToPath(moduleUrl)) return;
	const env = loadEnv();
	job(env, createDb(env.DATABASE_URL)).catch((err: unknown) => {
		console.error('backfill failed:', err);
		process.exit(1);
	});
}
