import { describe, expect, it } from 'vitest';
import { publicValidationSchema } from './validation';

describe('publicValidationSchema', () => {
	it('parses a running job with progress rows', () => {
		const result = publicValidationSchema.safeParse({
			job: {
				state: 'running',
				progress: [
					{ key: 'fetch', label: 'Fetch source snapshot', state: 'ok' },
					{ key: 'structure', label: 'Check package structure', state: 'running' },
				],
				error: null,
			},
			submissionStatus: 'validating',
			report: null,
		});
		expect(result.success).toBe(true);
	});

	it('parses a missing job (enqueue never landed)', () => {
		const result = publicValidationSchema.safeParse({
			job: null,
			submissionStatus: 'draft',
			report: null,
		});
		expect(result.success).toBe(true);
	});

	it('parses a done job with the report summary', () => {
		const result = publicValidationSchema.safeParse({
			job: { state: 'done', progress: [], error: null },
			submissionStatus: 'passed',
			report: { status: 'passed', riskLevel: 'low' },
		});
		expect(result.success).toBe(true);
	});

	it('strips unexpected report fields so findings cannot ride along', () => {
		const result = publicValidationSchema.parse({
			job: null,
			submissionStatus: 'failed',
			report: { status: 'failed', riskLevel: 'low', failures: [{ code: 'secret-pattern' }] },
		});
		expect(result.report).toEqual({ status: 'failed', riskLevel: 'low' });
	});

	it('rejects an unknown job state', () => {
		const result = publicValidationSchema.safeParse({
			job: { state: 'paused', progress: [], error: null },
			submissionStatus: 'validating',
			report: null,
		});
		expect(result.success).toBe(false);
	});
});
