import { buildReport, loadPackageFromFiles, RULES, type RuleFinding } from 'validator';
import type { Db } from '../db/client';
import { findSubmissionById, setSubmissionStatus } from '../db/submissions';
import {
	findValidationJobForSubmission,
	markValidationJobDone,
	markValidationJobError,
	markValidationJobRunning,
	updateValidationJobProgress,
	upsertValidationReport,
} from '../db/validation';
import type { ProgressStep, ProgressStepState } from '../db/schema';
import type { Env } from '../env';
import { getSnapshotDocument, R2_MISSING } from '../storage/r2';

export interface ProcessorDeps {
	fetchSnapshotDocument: typeof getSnapshotDocument;
	now: () => Date;
}

const FETCH_KEY = 'fetch';
const REPORT_KEY = 'report';

function initialProgress(): ProgressStep[] {
	return [
		{ key: FETCH_KEY, label: 'Fetch source snapshot' },
		...RULES.map((rule) => ({ key: rule.key, label: rule.label })),
		{ key: REPORT_KEY, label: 'Store validation report' },
	].map((step) => ({ ...step, state: 'pending' as const }));
}

function setStep(
	progress: ProgressStep[],
	key: string,
	state: ProgressStepState,
): ProgressStep[] {
	return progress.map((step) => (step.key === key ? { ...step, state } : step));
}

function ruleState(findings: RuleFinding[]): ProgressStepState {
	if (findings.some((f) => f.severity === 'failure')) return 'fail';
	return findings.length > 0 ? 'warn' : 'ok';
}

// Throwing means "retryable" (BullMQ backs off and retries); returning after
// markValidationJobError means terminal. The worker shell routes exhausted
// retries to handleValidationFailure.
export async function processValidationJob(
	env: Env,
	db: Db,
	submissionId: number,
	deps: Partial<ProcessorDeps> = {},
): Promise<void> {
	const { fetchSnapshotDocument = getSnapshotDocument, now = () => new Date() } = deps;

	const job = await findValidationJobForSubmission(db, submissionId);
	if (!job) {
		throw new Error(`no validation job row for submission ${submissionId}`);
	}
	const submission = await findSubmissionById(db, submissionId);
	if (!submission) {
		await markValidationJobError(db, job.id, `submission ${submissionId} not found`);
		return;
	}

	let progress = initialProgress();
	await markValidationJobRunning(db, job.id, progress);
	await setSubmissionStatus(db, submissionId, 'validating');

	progress = setStep(progress, FETCH_KEY, 'running');
	await updateValidationJobProgress(db, job.id, progress);
	const snapshot = await fetchSnapshotDocument(env, submission.snapshotKey);
	if (!snapshot.success) {
		progress = setStep(progress, FETCH_KEY, 'fail');
		await updateValidationJobProgress(db, job.id, progress);
		if (snapshot.error === R2_MISSING) {
			await markValidationJobError(db, job.id, 'source snapshot is missing from storage');
			await setSubmissionStatus(db, submissionId, 'draft');
			return;
		}
		throw new Error(snapshot.error);
	}
	progress = setStep(progress, FETCH_KEY, 'ok');
	await updateValidationJobProgress(db, job.id, progress);

	const pkg = loadPackageFromFiles(snapshot.data.files, `submission-${submissionId}`);
	const findings: RuleFinding[] = [];
	for (const rule of RULES) {
		progress = setStep(progress, rule.key, 'running');
		await updateValidationJobProgress(db, job.id, progress);
		const ruleFindings = rule.run(pkg);
		findings.push(...ruleFindings);
		progress = setStep(progress, rule.key, ruleState(ruleFindings));
		await updateValidationJobProgress(db, job.id, progress);
	}

	progress = setStep(progress, REPORT_KEY, 'running');
	await updateValidationJobProgress(db, job.id, progress);
	const report = buildReport(pkg, findings, { now: now() });
	await upsertValidationReport(db, {
		submissionId,
		status: report.status,
		riskLevel: report.riskLevel,
		sourceHash: report.sourceHash,
		engineVersion: report.engineVersion,
		report,
	});
	progress = setStep(progress, REPORT_KEY, 'ok');

	await setSubmissionStatus(db, submissionId, report.status);
	await markValidationJobDone(db, job.id, progress);
}

// Terminal failure (BullMQ retries exhausted): record the error and put the
// submission back to draft so it can be retried.
export async function handleValidationFailure(
	db: Db,
	submissionId: number,
	message: string,
): Promise<void> {
	const job = await findValidationJobForSubmission(db, submissionId);
	if (job) {
		await markValidationJobError(db, job.id, message);
	}
	await setSubmissionStatus(db, submissionId, 'draft');
}
