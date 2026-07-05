import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { loadEnv } from '../env';

const env = loadEnv();
const db = drizzle(neon(env.DATABASE_URL));

await migrate(db, { migrationsFolder: 'drizzle' });
console.log('migrations applied');
