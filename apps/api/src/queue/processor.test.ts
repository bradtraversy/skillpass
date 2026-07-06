import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client';
import type { ProgressStep, SubmissionRow, ValidationJobRow } from '../db/schema';
import { findSubmissionById, setSubmissionStatus } from '../db/submissions';
import {
	findValidationJobForSubmission,
	markValidationJobDone,
	markValidationJobError,
	markValidationJobRunning,
	updateValidationJobProgress,
	upsertValidationReport,
} from '../db/validation';
import { loadEnv } from '../env';
import { R2_MISSING, type getSnapshotDocument } from '../storage/r2';
import { RAW_TEST_ENV } from '../testing/env';
import { handleValidationFailure, processValidationJob } from './processor';

vi.mock('../db/submissions', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/submissions')>()),
	findSubmissionById: vi.fn(),
	setSubmissionStatus: vi.fn(),
}));
vi.mock('../db/validation', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/validation')>()),
	findValidationJobForSubmission: vi.fn(),
	markValidationJobRunning: vi.fn(),
	updateValidationJobProgress: vi.fn(),
	markValidationJobDone: vi.fn(),
	markValidationJobError: vi.fn(),
	upsertValidationReport: vi.fn(),
}));

const env = loadEnv(RAW_TEST_ENV);
const db = {} as Db;
const NOW = new Date('2026-07-06T12:00:00Z');

const jobRow: ValidationJobRow = {
	id: 55,
	submissionId: 1,
	state: 'queued',
	progress: [],
	bullJobId: 'bull-1',
	error: null,
	startedAt: null,
	finishedAt: null,
	createdAt: new Date('2026-07-06T09:00:00Z'),
};

const submissionRow: SubmissionRow = {
	id: 1,
	userId: 7,
	sourceType: 'github_url',
	githubUrl: 'https://github.com/octocat/hello',
	uploadedZipKey: null,
	status: 'draft',
	resolvedCommitSha: 'abc123',
	sourceHash: 'sha256:ignored',
	snapshotKey: 'snapshots/abc.json',
	createdAt: new Date('2026-07-05T12:00:00Z'),
};

const CLEAN_FILES = [
	{
		path: 'skill.json',
		content: JSON.stringify({
			schemaVersion: '0.1',
			name: 'clean-skill',
			description: 'A tidy demo skill.',
			targets: ['claude-code'],
			permissions: [],
		}),
	},
	{ path: 'SKILL.md', content: '# clean-skill\n\nSummarize the changelog for the user.\n' },
];

const NO_MANIFEST_FILES = [
	{ path: 'SKILL.md', content: '# mystery\n\nDo something helpful.\n' },
];

const SECRET_FILES = [
	...CLEAN_FILES.slice(0, 1),
	{ path: 'SKILL.md', content: '# leaky\n\nUse AKIAIOSFODNN7EXAMPLE to sign requests.\n' },
];

function snapshotOk(files: { path: string; content: string }[]) {
	return vi
		.fn()
		.mockResolvedValue({ success: true, data: { version: 1, files } }) as unknown as typeof getSnapshotDocument;
}

function mockRows() {
	vi.mocked(findValidationJobForSubmission).mockResolvedValue(jobRow);
	vi.mocked(findSubmissionById).mockResolvedValue(submissionRow);
}

function doneProgress(): ProgressStep[] {
	const [call] = vi.mocked(markValidationJobDone).mock.calls;
	return call[2];
}

beforeEach(() => vi.clearAllMocks());

describe('processValidationJob', () => {
	it('passes a clean package: report stored, submission passed, job done, all steps ok', async () => {
		mockRows();
		await processValidationJob(env, db, 1, {
			fetchSnapshotDocument: snapshotOk(CLEAN_FILES),
			now: () => NOW,
		});

		expect(vi.mocked(markValidationJobRunning)).toHaveBeenCalledWith(db, 55, expect.anything());
		expect(vi.mocked(setSubmissionStatus)).toHaveBeenNthCalledWith(1, db, 1, 'validating');
		expect(vi.mocked(upsertValidationReport)).toHaveBeenCalledWith(
			db,
			expect.objectContaining({
				submissionId: 1,
				status: 'passed',
				riskLevel: 'low',
				engineVersion: '0.1.0',
				sourceHash: expect.stringMatching(/^sha256:/),
			}),
		);
		expect(vi.mocked(setSubmissionStatus)).toHaveBeenLastCalledWith(db, 1, 'passed');
		expect(vi.mocked(markValidationJobDone)).toHaveBeenCalledWith(db, 55, expect.anything());
		expect(doneProgress().map((s) => s.state)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
		expect(vi.mocked(markValidationJobError)).not.toHaveBeenCalled();
	});

	it('marks a manifest-less package warning, with the structure step warned', async () => {
		mockRows();
		await processValidationJob(env, db, 1, {
			fetchSnapshotDocument: snapshotOk(NO_MANIFEST_FILES),
			now: () => NOW,
		});

		expect(vi.mocked(upsertValidationReport)).toHaveBeenCalledWith(
			db,
			expect.objectContaining({ status: 'warning' }),
		);
		expect(vi.mocked(setSubmissionStatus)).toHaveBeenLastCalledWith(db, 1, 'warning');
		expect(doneProgress().find((s) => s.key === 'structure')?.state).toBe('warn');
	});

	it('fails a package with a secret, with the content step failed', async () => {
		mockRows();
		await processValidationJob(env, db, 1, {
			fetchSnapshotDocument: snapshotOk(SECRET_FILES),
			now: () => NOW,
		});

		expect(vi.mocked(upsertValidationReport)).toHaveBeenCalledWith(
			db,
			expect.objectContaining({ status: 'failed' }),
		);
		expect(vi.mocked(setSubmissionStatus)).toHaveBeenLastCalledWith(db, 1, 'failed');
		expect(doneProgress().find((s) => s.key === 'content')?.state).toBe('fail');
		expect(vi.mocked(markValidationJobDone)).toHaveBeenCalled();
	});

	it('treats a missing snapshot as terminal: job error, submission back to draft, no retry throw', async () => {
		mockRows();
		const fetchSnapshotDocument = vi
			.fn()
			.mockResolvedValue({ success: false, error: R2_MISSING }) as unknown as typeof getSnapshotDocument;

		await processValidationJob(env, db, 1, { fetchSnapshotDocument });

		expect(vi.mocked(markValidationJobError)).toHaveBeenCalledWith(
			db,
			55,
			'source snapshot is missing from storage',
		);
		expect(vi.mocked(setSubmissionStatus)).toHaveBeenLastCalledWith(db, 1, 'draft');
		expect(vi.mocked(upsertValidationReport)).not.toHaveBeenCalled();
		expect(vi.mocked(markValidationJobDone)).not.toHaveBeenCalled();
	});

	it('throws on an R2 outage so BullMQ retries, leaving the job un-terminal', async () => {
		mockRows();
		const fetchSnapshotDocument = vi
			.fn()
			.mockResolvedValue({
				success: false,
				error: 'r2 get errored: offline',
			}) as unknown as typeof getSnapshotDocument;

		await expect(processValidationJob(env, db, 1, { fetchSnapshotDocument })).rejects.toThrow(
			'r2 get errored: offline',
		);
		expect(vi.mocked(upsertValidationReport)).not.toHaveBeenCalled();
		expect(vi.mocked(markValidationJobError)).not.toHaveBeenCalled();
		expect(vi.mocked(markValidationJobDone)).not.toHaveBeenCalled();
		const calls = vi.mocked(updateValidationJobProgress).mock.calls;
		const last = calls[calls.length - 1][2];
		expect(last.find((s) => s.key === 'fetch')?.state).toBe('fail');
	});

	it('marks the job error without touching validation when the submission row is gone', async () => {
		vi.mocked(findValidationJobForSubmission).mockResolvedValue(jobRow);
		vi.mocked(findSubmissionById).mockResolvedValue(undefined);

		await processValidationJob(env, db, 1, { fetchSnapshotDocument: snapshotOk(CLEAN_FILES) });

		expect(vi.mocked(markValidationJobError)).toHaveBeenCalledWith(db, 55, 'submission 1 not found');
		expect(vi.mocked(setSubmissionStatus)).not.toHaveBeenCalled();
	});
});

describe('handleValidationFailure', () => {
	it('records the terminal error and puts the submission back to draft', async () => {
		vi.mocked(findValidationJobForSubmission).mockResolvedValue(jobRow);
		await handleValidationFailure(db, 1, 'r2 get errored: offline');
		expect(vi.mocked(markValidationJobError)).toHaveBeenCalledWith(db, 55, 'r2 get errored: offline');
		expect(vi.mocked(setSubmissionStatus)).toHaveBeenCalledWith(db, 1, 'draft');
	});

	it('still resets the submission when no job row exists', async () => {
		vi.mocked(findValidationJobForSubmission).mockResolvedValue(undefined);
		await handleValidationFailure(db, 1, 'boom');
		expect(vi.mocked(markValidationJobError)).not.toHaveBeenCalled();
		expect(vi.mocked(setSubmissionStatus)).toHaveBeenCalledWith(db, 1, 'draft');
	});
});
