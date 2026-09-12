import type { Result } from './result';
import { z } from 'zod';

// Submission lifecycle enums. Distinct from SkillVersion's SourceType
// ('github' | 'zip') - a submission records how it arrived, per the data model.
export const SUBMISSION_SOURCE_TYPES = ['github_url', 'zip'] as const;
export const SUBMISSION_STATUSES = ['draft', 'validating', 'passed', 'warning', 'failed', 'published'] as const;

export const submissionSourceTypeSchema = z.enum(SUBMISSION_SOURCE_TYPES);
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);

export type SubmissionSourceType = z.infer<typeof submissionSourceTypeSchema>;
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

// What the API returns for a submission - the shape the web islands render.
// Internal fields (userId, snapshotKey, uploadedZipKey) never cross this boundary.
export interface PublicSubmission {
	id: number;
	sourceType: SubmissionSourceType;
	githubUrl: string | null;
	status: SubmissionStatus;
	resolvedCommitSha: string | null;
	sourceHash: string;
	createdAt: string;
}

// What the submit endpoint saw in the snapshot, returned once on creation so the
// form can confirm the package shape before validation finishes. 'inferred' means
// a bare SKILL.md with no skill.json; name is null unless a manifest resolved.
export type ManifestDetection = 'ok' | 'inferred' | 'missing' | 'invalid';

export interface DetectedPackage {
	skillMd: boolean;
	manifest: ManifestDetection;
	name: string | null;
	// Member count when the package is a multi-skill pack; null for a single skill.
	skillCount: number | null;
}

export interface CreatedSubmission extends PublicSubmission {
	detected: DetectedPackage;
}

// The API's HTTP response wrapper. Structurally like ParseResult, declared
// separately so the wire contract can grow without touching parse semantics.
export type ApiEnvelope<T> = Result<T>;

// Compressed zip upload cap - part of the API contract so the web island can
// pre-check before uploading and the API enforces before buffering.
export const MAX_ZIP_BYTES = 10 * 1024 * 1024;
