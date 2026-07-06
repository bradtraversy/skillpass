import { describe, expect, it, vi } from 'vitest';
import { Queue } from 'bullmq';
import { loadEnv } from '../env';
import { RAW_TEST_ENV } from '../testing/env';
import {
	createValidationQueue,
	enqueueValidation,
	VALIDATION_QUEUE_NAME,
	type ValidationQueue,
} from './queue';

vi.mock('bullmq', () => ({ Queue: vi.fn() }));

const env = loadEnv(RAW_TEST_ENV);

describe('createValidationQueue', () => {
	it('builds the validate-submission queue on a fail-fast BullMQ connection', () => {
		createValidationQueue(env);
		expect(Queue).toHaveBeenCalledWith(VALIDATION_QUEUE_NAME, {
			connection: {
				url: 'redis://localhost:6379',
				maxRetriesPerRequest: null,
				enableOfflineQueue: false,
			},
		});
	});
});

describe('enqueueValidation', () => {
	const fakeQueue = (add: ReturnType<typeof vi.fn>) => ({ add }) as unknown as ValidationQueue;

	it('adds the {submissionId} payload with capped retries and returns the job id', async () => {
		const add = vi.fn().mockResolvedValue({ id: '42' });
		const result = await enqueueValidation(fakeQueue(add), 7);
		expect(result).toEqual({ success: true, data: '42' });
		expect(add).toHaveBeenCalledWith(
			'validate',
			{ submissionId: 7 },
			{ attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
		);
	});

	it('returns null data when BullMQ assigns no id', async () => {
		const add = vi.fn().mockResolvedValue({ id: undefined });
		const result = await enqueueValidation(fakeQueue(add), 7);
		expect(result).toEqual({ success: true, data: null });
	});

	it('maps a dead Redis to an error result instead of throwing', async () => {
		const add = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379'));
		const result = await enqueueValidation(fakeQueue(add), 7);
		expect(result).toEqual({
			success: false,
			error: 'enqueue failed: connect ECONNREFUSED 127.0.0.1:6379',
		});
	});
});
