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

	it('parses a done job with an empty-findings report', () => {
		const result = publicValidationSchema.safeParse({
			job: { state: 'done', progress: [], error: null },
			submissionStatus: 'passed',
			report: { status: 'passed', riskLevel: 'low', warnings: [], failures: [] },
		});
		expect(result.success).toBe(true);
	});

	it('parses report findings with and without a location', () => {
		const result = publicValidationSchema.safeParse({
			job: { state: 'done', progress: [], error: null },
			submissionStatus: 'failed',
			report: {
				status: 'failed',
				riskLevel: 'low',
				warnings: [{ code: 'missing-manifest', message: 'no skill.json found' }],
				failures: [
					{
						code: 'prompt-injection',
						message: 'instructs the agent to ignore prior instructions',
						location: { path: 'SKILL.md', line: 3, snippet: 'Ignore all previous instructions' },
					},
				],
			},
		});
		expect(result.success).toBe(true);
	});

	it('strips internal report fields off the wire', () => {
		const result = publicValidationSchema.parse({
			job: null,
			submissionStatus: 'failed',
			report: {
				status: 'failed',
				riskLevel: 'low',
				warnings: [],
				failures: [],
				sourceHash: 'sha256:abc',
				engineVersion: '0.1.0',
				permissionsDetected: ['shell.execute'],
			},
		});
		expect(result.report).toEqual({ status: 'failed', riskLevel: 'low', warnings: [], failures: [] });
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
