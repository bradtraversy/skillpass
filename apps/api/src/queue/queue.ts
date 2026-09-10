import { Queue } from 'bullmq';
import type { Env } from '../env';
import { redisConnection } from './connection';
import type { Result } from 'skill-schema';

export const VALIDATION_QUEUE_NAME = 'validate-submission';

// Only the id crosses the queue; the worker re-reads everything from the DB
// so payloads cannot go stale.
export interface ValidationJobPayload {
	submissionId: number;
}

// enableOfflineQueue: false makes add() reject promptly when Redis is down
// instead of buffering forever; the routes degrade to an error job row.
export function createValidationQueue(env: Env) {
	return new Queue<ValidationJobPayload>(VALIDATION_QUEUE_NAME, {
		connection: redisConnection(env, { enableOfflineQueue: false }),
	});
}

export type ValidationQueue = Pick<ReturnType<typeof createValidationQueue>, 'add'>;

export async function enqueueValidation(
	queue: ValidationQueue,
	submissionId: number,
): Promise<Result<string | null>> {
	try {
		const job = await queue.add(
			'validate',
			{ submissionId },
			{ attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
		);
		return { success: true, data: job.id ?? null };
	} catch (err) {
		return { success: false, error: `enqueue failed: ${(err as Error).message}` };
	}
}
