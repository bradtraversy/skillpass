import type { AbuseReportStatus, SkillStatus, SubmissionStatus } from 'skill-schema';

const PASS = 'text-pass border-pass-line bg-pass-soft';
const WARN = 'text-warn border-warn-line bg-warn-soft';
const FAIL = 'text-fail border-fail-line bg-fail-soft';
const NEUTRAL = 'text-unv border-unv-line bg-unv-soft';
const ACTIVE = 'text-accent border-accent-line bg-accent-soft';

// Dashboard chip tints for listing, submission, and abuse-report statuses,
// mapped onto the same tokens the validation stamps use so the vocabularies
// read as one.
export const STATUS_TINT: Record<SkillStatus | SubmissionStatus | AbuseReportStatus, string> = {
	published: PASS,
	draft: NEUTRAL,
	private: NEUTRAL,
	flagged: FAIL,
	validating: ACTIVE,
	passed: PASS,
	warning: WARN,
	failed: FAIL,
	open: WARN,
	reviewed: NEUTRAL,
	actioned: FAIL,
};
