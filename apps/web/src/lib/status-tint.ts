import type { AbuseReportStatus, SkillStatus, SubmissionStatus } from 'skill-schema';
import { VERDICT_TINT } from './verdict';

const PASS = VERDICT_TINT.passed.all;
const WARN = VERDICT_TINT.warning.all;
const FAIL = VERDICT_TINT.failed.all;
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
