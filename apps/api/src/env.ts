import { z } from 'zod';

const envSchema = z.object({
	DATABASE_URL: z.string().min(1),
	GITHUB_CLIENT_ID: z.string().min(1),
	GITHUB_CLIENT_SECRET: z.string().min(1),
	SESSION_SECRET: z.string().min(32, 'use a long random string, e.g. openssl rand -hex 32'),
	WEB_ORIGIN: z.url().default('http://localhost:4321'),
	PORT: z.coerce.number().int().positive().default(8787),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
	return envSchema.parse(source);
}
