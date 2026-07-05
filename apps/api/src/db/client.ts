import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export function createDb(databaseUrl: string) {
	return drizzle(neon(databaseUrl));
}

export type Db = ReturnType<typeof createDb>;
