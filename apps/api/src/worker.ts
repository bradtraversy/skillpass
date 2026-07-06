import { Worker } from 'bullmq';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { redisConnection } from './queue/connection';
import { handleValidationFailure, processValidationJob } from './queue/processor';
import { VALIDATION_QUEUE_NAME, type ValidationJobPayload } from './queue/queue';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

const worker = new Worker<ValidationJobPayload>(
	VALIDATION_QUEUE_NAME,
	(job) => processValidationJob(env, db, job.data.submissionId),
	{ connection: redisConnection(env) },
);

worker.on('failed', (job, err) => {
	if (!job) return;
	const attempts = job.opts.attempts ?? 1;
	console.error(`job ${job.id} failed (attempt ${job.attemptsMade}/${attempts}): ${err.message}`);
	if (job.attemptsMade >= attempts) {
		handleValidationFailure(db, job.data.submissionId, err.message).catch((dbErr) =>
			console.error('could not record terminal failure', dbErr),
		);
	}
});

worker.on('error', (err) => console.error('worker error:', err.message));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		void worker.close().then(() => process.exit(0));
	});
}

console.log(`validation worker listening on "${VALIDATION_QUEUE_NAME}"`);
