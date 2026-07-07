import { z } from 'zod';
import { riskLevelSchema, validationStatusSchema } from './enums';
import { submissionStatusSchema } from './submission';

// Job lifecycle + progress rows, shared by the API's job records (6a) and the
// /submit progress panel (6b). The worker writes these; the panel renders them.
export const VALIDATION_JOB_STATES = ['queued', 'running', 'done', 'error'] as const;
export const PROGRESS_STEP_STATES = ['pending', 'running', 'ok', 'warn', 'fail'] as const;

export const validationJobStateSchema = z.enum(VALIDATION_JOB_STATES);
export const progressStepStateSchema = z.enum(PROGRESS_STEP_STATES);

export type ValidationJobState = z.infer<typeof validationJobStateSchema>;
export type ProgressStepState = z.infer<typeof progressStepStateSchema>;

export const progressStepSchema = z.object({
	key: z.string(),
	label: z.string(),
	state: progressStepStateSchema,
});

export type ProgressStep = z.infer<typeof progressStepSchema>;

// What GET /submissions/:id/validation returns. The report collapses to a
// status/risk summary - findings stay private until feature 7's publish gate.
export const publicValidationSchema = z.object({
	job: z
		.object({
			state: validationJobStateSchema,
			progress: z.array(progressStepSchema),
			error: z.string().nullable(),
		})
		.nullable(),
	submissionStatus: submissionStatusSchema,
	report: z
		.object({
			status: validationStatusSchema,
			riskLevel: riskLevelSchema,
		})
		.nullable(),
});

export type PublicValidation = z.infer<typeof publicValidationSchema>;
