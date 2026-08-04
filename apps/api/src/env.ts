import { z } from 'zod';

const envSchema = z
	.object({
		DATABASE_URL: z.string().min(1),
		GITHUB_CLIENT_ID: z.string().min(1),
		GITHUB_CLIENT_SECRET: z.string().min(1),
		SESSION_SECRET: z.string().min(32, 'use a long random string, e.g. openssl rand -hex 32'),
		GITHUB_TOKEN: z.string().optional(),
		// Optional: enables the AI skill reviewer (feature 18). Absent -> the
		// reviewer returns null and publishing proceeds without an AI review.
		ANTHROPIC_API_KEY: z.string().optional(),
		// Optional: enables skill embeddings for AI search (feature 20). Absent ->
		// embedding generation no-ops and publishing proceeds without one.
		VOYAGE_API_KEY: z.string().optional(),
		R2_ACCOUNT_ID: z.string().min(1),
		R2_ACCESS_KEY_ID: z.string().min(1),
		R2_SECRET_ACCESS_KEY: z.string().min(1),
		R2_BUCKET: z.string().min(1),
		// inline validates in the API request (no worker/Redis); queue enqueues to
		// the BullMQ worker. REDIS_URL is required only in queue mode (below).
		VALIDATION_MODE: z.enum(['queue', 'inline']).default('inline'),
		REDIS_URL: z.string().min(1).optional(),
		WEB_ORIGIN: z.url().default('http://localhost:4321'),
		PORT: z.coerce.number().int().positive().default(8787),
	})
	.superRefine((env, ctx) => {
		if (env.VALIDATION_MODE === 'queue' && !env.REDIS_URL) {
			ctx.addIssue({
				code: 'custom',
				path: ['REDIS_URL'],
				message: 'REDIS_URL is required when VALIDATION_MODE is "queue"',
			});
		}
	});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
	return envSchema.parse(source);
}
