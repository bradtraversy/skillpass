import type { ValidationReport } from 'skill-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client';
import type { SkillRow, SkillVersionRow, SubmissionRow, ValidationReportRow } from '../db/schema';
import {
	createSkill,
	createSkillPassport,
	createSkillVersion,
	findLatestVersionForSkill,
	findSkillBySlug,
	setLatestVersion,
} from '../db/skills';
import { setSubmissionStatus } from '../db/submissions';
import { awardReputation } from '../reputation/reputation';
import { publishSubmission } from './publish';

vi.mock('../db/skills', () => ({
	findSkillBySlug: vi.fn(),
	findLatestVersionForSkill: vi.fn(),
	createSkill: vi.fn(),
	createSkillVersion: vi.fn(),
	createSkillPassport: vi.fn(),
	setLatestVersion: vi.fn(),
}));
vi.mock('../db/submissions', async (importOriginal) => ({
	...(await importOriginal<typeof import('../db/submissions')>()),
	setSubmissionStatus: vi.fn(),
}));
vi.mock('../reputation/reputation', async (importOriginal) => ({
	...(await importOriginal<typeof import('../reputation/reputation')>()),
	awardReputation: vi.fn(),
}));

const db = {} as Db;
const NOW = new Date('2026-07-07T15:00:00Z');

const reportDoc: ValidationReport = {
	schemaVersion: '0.1',
	status: 'passed',
	riskLevel: 'low',
	sourceHash: 'sha256:abc',
	engineVersion: 'validator-0.1.0',
	permissionsDeclared: [],
	permissionsDetected: ['network.fetch'],
	warnings: [],
	failures: [],
	createdAt: '2026-07-07T14:00:00.000Z',
};

const reportRow: ValidationReportRow = {
	id: 9,
	submissionId: 1,
	status: 'passed',
	riskLevel: 'low',
	sourceHash: 'sha256:abc',
	engineVersion: 'validator-0.1.0',
	report: reportDoc,
	createdAt: new Date('2026-07-07T14:00:00Z'),
};

const githubSubmission: SubmissionRow = {
	id: 1,
	userId: 7,
	sourceType: 'github_url',
	githubUrl: 'https://github.com/octocat/hello',
	uploadedZipKey: null,
	status: 'passed',
	resolvedCommitSha: 'abc123',
	sourceHash: 'sha256:abc',
	snapshotKey: 'snapshots/abc.json',
	createdAt: new Date('2026-07-05T12:00:00Z'),
};

const zipSubmission: SubmissionRow = {
	...githubSubmission,
	id: 2,
	sourceType: 'zip',
	githubUrl: null,
	uploadedZipKey: 'uploads/abc.zip',
	resolvedCommitSha: null,
};

const skillRow: SkillRow = {
	id: 3,
	slug: 'clean-skill',
	name: 'Clean Skill',
	summary: 'A tidy demo skill.',
	maintainerId: 7,
	attributedTo: null,
	status: 'published',
	featured: false,
	verified: false,
	latestVersionId: null,
	createdAt: new Date('2026-07-07T15:00:00Z'),
	updatedAt: new Date('2026-07-07T15:00:00Z'),
};

function versionRow(overrides: Partial<SkillVersionRow> = {}): SkillVersionRow {
	return {
		id: 11,
		skillId: 3,
		version: '1.0.0',
		sourceType: 'github',
		githubRepoUrl: 'https://github.com/octocat/hello',
		resolvedCommitSha: 'abc123',
		sourceHash: 'sha256:abc',
		snapshotKey: 'snapshots/abc.json',
		targets: ['claude-code'],
		submissionId: 1,
		publishedAt: NOW,
		createdAt: NOW,
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('publishSubmission', () => {
	it('first publish creates skill, version 1.0.0, passport, then flips the submission', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		vi.mocked(createSkill).mockResolvedValue(skillRow);
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(undefined);
		vi.mocked(createSkillVersion).mockResolvedValue(versionRow());

		const outcome = await publishSubmission(db, {
			submission: githubSubmission,
			report: reportRow,
			name: 'Clean Skill',
			summary: 'A tidy demo skill.',
			targets: ['claude-code'],
			attributedTo: null,
			now: NOW,
		});

		expect(outcome).toEqual({ success: true, data: { slug: 'clean-skill', version: '1.0.0' } });
		expect(createSkill).toHaveBeenCalledWith(db, {
			slug: 'clean-skill',
			name: 'Clean Skill',
			summary: 'A tidy demo skill.',
			maintainerId: 7,
			attributedTo: null,
			status: 'published',
			verified: false,
		});
		expect(createSkillVersion).toHaveBeenCalledWith(db, {
			skillId: 3,
			version: '1.0.0',
			sourceType: 'github',
			githubRepoUrl: 'https://github.com/octocat/hello',
			resolvedCommitSha: 'abc123',
			sourceHash: 'sha256:abc',
			snapshotKey: 'snapshots/abc.json',
			targets: ['claude-code'],
			submissionId: 1,
			publishedAt: NOW,
		});
		expect(createSkillPassport).toHaveBeenCalledWith(db, {
			skillVersionId: 11,
			passport: expect.objectContaining({
				validationStatus: 'passed',
				riskLevel: 'low',
				resolvedCommitSha: 'abc123',
				generatedAt: NOW.toISOString(),
			}),
			validationStatus: 'passed',
			riskLevel: 'low',
			generatedAt: NOW,
		});
		expect(setLatestVersion).toHaveBeenCalledWith(
			db,
			3,
			11,
			{ name: 'Clean Skill', summary: 'A tidy demo skill.' },
			NOW,
		);
		expect(setSubmissionStatus).toHaveBeenCalledWith(db, 1, 'published');

		const order = [
			vi.mocked(createSkillVersion).mock.invocationCallOrder[0],
			vi.mocked(createSkillPassport).mock.invocationCallOrder[0],
			vi.mocked(setLatestVersion).mock.invocationCallOrder[0],
			vi.mocked(setSubmissionStatus).mock.invocationCallOrder[0],
		];
		expect(order).toEqual([...order].sort((a, b) => a - b));
	});

	it('creates the skill verified when the input is verified (admin-curated add)', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		vi.mocked(createSkill).mockResolvedValue(skillRow);
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(undefined);
		vi.mocked(createSkillVersion).mockResolvedValue(versionRow());

		await publishSubmission(db, {
			submission: githubSubmission,
			report: reportRow,
			name: 'Clean Skill',
			summary: 'A tidy demo skill.',
			targets: ['claude-code'],
			attributedTo: 'octocat',
			verified: true,
			now: NOW,
		});

		expect(createSkill).toHaveBeenCalledWith(db, expect.objectContaining({ verified: true }));
	});

	it('re-publish by the same maintainer bumps the major on the existing skill', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...skillRow, latestVersionId: 11 });
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(versionRow({ version: '2.0.0' }));
		vi.mocked(createSkillVersion).mockResolvedValue(
			versionRow({ id: 12, version: '3.0.0', sourceType: 'zip', submissionId: 2 }),
		);

		const outcome = await publishSubmission(db, {
			submission: zipSubmission,
			report: { ...reportRow, submissionId: 2 },
			name: 'Clean Skill',
			summary: 'A tidier demo skill, third pass.',
			targets: ['claude-code', 'codex'],
			attributedTo: null,
			now: NOW,
		});

		expect(outcome).toEqual({ success: true, data: { slug: 'clean-skill', version: '3.0.0' } });
		expect(createSkill).not.toHaveBeenCalled();
		expect(createSkillVersion).toHaveBeenCalledWith(
			db,
			expect.objectContaining({
				version: '3.0.0',
				sourceType: 'zip',
				githubRepoUrl: null,
				resolvedCommitSha: null,
				targets: ['claude-code', 'codex'],
				submissionId: 2,
			}),
		);
		// The listing copy refreshes to describe the newly published version.
		expect(setLatestVersion).toHaveBeenCalledWith(
			db,
			3,
			12,
			{ name: 'Clean Skill', summary: 'A tidier demo skill, third pass.' },
			NOW,
		);
		expect(setSubmissionStatus).toHaveBeenCalledWith(db, 2, 'published');
		expect(awardReputation).toHaveBeenCalledWith(db, 7, 'version_published');
	});

	it('awards skill_published reputation on a first publish', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		vi.mocked(createSkill).mockResolvedValue(skillRow);
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(undefined);
		vi.mocked(createSkillVersion).mockResolvedValue(versionRow());

		const outcome = await publishSubmission(db, {
			submission: githubSubmission,
			report: reportRow,
			name: 'Clean Skill',
			summary: 'A tidy demo skill.',
			targets: ['claude-code'],
			attributedTo: null,
			now: NOW,
		});

		expect(outcome.success).toBe(true);
		expect(awardReputation).toHaveBeenCalledWith(db, 7, 'skill_published');
	});

	it('still publishes when the reputation award fails', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		vi.mocked(createSkill).mockResolvedValue(skillRow);
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(undefined);
		vi.mocked(createSkillVersion).mockResolvedValue(versionRow());
		vi.mocked(awardReputation).mockRejectedValue(new Error('db down'));

		const outcome = await publishSubmission(db, {
			submission: githubSubmission,
			report: reportRow,
			name: 'Clean Skill',
			summary: 'A tidy demo skill.',
			targets: ['claude-code'],
			attributedTo: null,
			now: NOW,
		});

		expect(outcome).toEqual({ success: true, data: { slug: 'clean-skill', version: '1.0.0' } });
	});

	it('refuses a slug owned by another maintainer without writing anything', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue({ ...skillRow, maintainerId: 99 });

		const outcome = await publishSubmission(db, {
			submission: githubSubmission,
			report: reportRow,
			name: 'Clean Skill',
			summary: 'A tidy demo skill.',
			targets: ['claude-code'],
			attributedTo: null,
			now: NOW,
		});

		expect(outcome).toEqual({ success: false, error: 'slug_taken' });
		expect(createSkill).not.toHaveBeenCalled();
		expect(createSkillVersion).not.toHaveBeenCalled();
		expect(createSkillPassport).not.toHaveBeenCalled();
		expect(setSubmissionStatus).not.toHaveBeenCalled();
		expect(awardReputation).not.toHaveBeenCalled();
	});
});
