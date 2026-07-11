import { describe, expect, it } from 'vitest';
import {
	adminQueueSchema,
	parseResolveReportInput,
	resolveReportInputSchema,
} from './admin';

describe('resolveReportInputSchema', () => {
	it('accepts the two terminal statuses', () => {
		expect(resolveReportInputSchema.parse({ status: 'reviewed' })).toEqual({ status: 'reviewed' });
		expect(resolveReportInputSchema.parse({ status: 'actioned' })).toEqual({ status: 'actioned' });
	});

	it('rejects the initial "open" status', () => {
		expect(parseResolveReportInput({ status: 'open' }).success).toBe(false);
	});

	it('rejects unknown statuses, missing status, and extra keys', () => {
		expect(parseResolveReportInput({ status: 'nope' }).success).toBe(false);
		expect(parseResolveReportInput({}).success).toBe(false);
		expect(parseResolveReportInput({ status: 'actioned', extra: 1 }).success).toBe(false);
	});
});

describe('adminQueueSchema', () => {
	it('parses a fully populated queue', () => {
		const queue = {
			reports: [
				{
					id: 1,
					reason: 'stolen skill',
					status: 'open',
					createdAt: '2026-07-09T10:00:00.000Z',
					skill: { slug: 'bad-skill', name: 'Bad Skill' },
					reporter: { username: 'reporter' },
				},
			],
			failedSubmissions: [
				{
					id: 7,
					sourceType: 'github_url',
					githubUrl: 'https://github.com/x/y',
					status: 'failed',
					createdAt: '2026-07-09T09:00:00.000Z',
					user: { username: 'submitter' },
					report: {
						status: 'failed',
						riskLevel: 'high',
						warnings: [],
						failures: [{ code: 'secret', message: 'hardcoded token' }],
					},
				},
			],
			flaggedSkills: [
				{ slug: 'flagged-one', name: 'Flagged One', maintainer: { username: 'owner' } },
			],
		};
		expect(adminQueueSchema.parse(queue)).toEqual(queue);
	});

	it('allows empty lists and a null report', () => {
		const queue = { reports: [], failedSubmissions: [], flaggedSkills: [] };
		expect(adminQueueSchema.parse(queue)).toEqual(queue);
	});
});
