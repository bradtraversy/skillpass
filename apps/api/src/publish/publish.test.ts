import type { Manifest, SkillEntry, ValidationReport } from 'skill-schema';
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
import { ensureIntegrations } from '../review/ensure';
import { ensureEmbedding } from '../search/ensure';
import { publishFieldsFrom, publishSubmission } from './publish';

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
vi.mock('../review/ensure', () => ({
	ensureAiReview: vi.fn(),
	ensureCategory: vi.fn(),
	ensureDisplayCopy: vi.fn(),
	ensureIntegrations: vi.fn(),
}));
vi.mock('../search/ensure', () => ({ ensureEmbedding: vi.fn() }));

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
	category: null,
	displayName: null,
	tagline: null,
	integrations: null,
	status: 'published',
	featured: false,
	featuredRank: null,
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
		packSkills: null,
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
		expect(ensureEmbedding).not.toHaveBeenCalled();
		expect(createSkillVersion).toHaveBeenCalledWith(db, {
			skillId: 3,
			version: '1.0.0',
			sourceType: 'github',
			githubRepoUrl: 'https://github.com/octocat/hello',
			resolvedCommitSha: 'abc123',
			sourceHash: 'sha256:abc',
			snapshotKey: 'snapshots/abc.json',
			targets: ['claude-code'],
			packSkills: null,
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

	it('runs the ensure chain with the embedding last when env is provided', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		vi.mocked(createSkill).mockResolvedValue(skillRow);
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(undefined);
		vi.mocked(createSkillVersion).mockResolvedValue(versionRow());

		const env = { VOYAGE_API_KEY: 'vk' } as never;
		await publishSubmission(db, {
			submission: githubSubmission,
			report: reportRow,
			name: 'Clean Skill',
			summary: 'A tidy demo skill.',
			targets: ['claude-code'],
			attributedTo: null,
			env,
			now: NOW,
		});

		expect(ensureEmbedding).toHaveBeenCalledWith(env, db, 'clean-skill');
		// The embedding must see the copy the other ensures wrote, so it runs last.
		expect(vi.mocked(ensureEmbedding).mock.invocationCallOrder[0]).toBeGreaterThan(
			vi.mocked(ensureIntegrations).mock.invocationCallOrder[0],
		);
	});

	it('round-trips pack members onto the version row', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
		vi.mocked(createSkill).mockResolvedValue(skillRow);
		vi.mocked(findLatestVersionForSkill).mockResolvedValue(undefined);
		vi.mocked(createSkillVersion).mockResolvedValue(versionRow());
		const members: SkillEntry[] = [
			{
				name: 'plan',
				entry: '.claude/skills/plan/SKILL.md',
				targets: ['claude-code', 'codex'],
				variants: { codex: '.agents/skills/plan/SKILL.md' },
			},
			{ name: 'apply', entry: '.claude/skills/apply/SKILL.md', targets: ['claude-code'] },
		];

		const outcome = await publishSubmission(db, {
			submission: githubSubmission,
			report: reportRow,
			name: 'my-pack',
			summary: 'A pack of 2 skills',
			targets: ['claude-code', 'codex'],
			packSkills: members,
			attributedTo: null,
			now: NOW,
		});

		expect(outcome.success).toBe(true);
		expect(createSkillVersion).toHaveBeenCalledWith(
			db,
			expect.objectContaining({ packSkills: members }),
		);
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

describe('publishFieldsFrom', () => {
	const manifest: Manifest = {
		schemaVersion: '0.1',
		name: 'demo',
		description: 'Demo skill.',
		targets: ['claude-code'],
		permissions: [],
		distribution: 'skill',
	};

	it('maps the manifest onto publish input as a single, author-declared skill', () => {
		expect(publishFieldsFrom(manifest)).toEqual({
			name: 'demo',
			summary: 'Demo skill.',
			targets: ['claude-code'],
			distribution: 'skill',
			homepage: undefined,
			install: undefined,
			manifestInferred: false,
			packSkills: null,
		});
	});

	it('treats two or more member skills as a pack and one as a single', () => {
		const one = [{ name: 'a', entry: 'skills/a/SKILL.md' }];
		expect(publishFieldsFrom({ ...manifest, skills: one }).packSkills).toBeNull();
		const two = [...one, { name: 'b', entry: 'skills/b/SKILL.md' }];
		expect(publishFieldsFrom({ ...manifest, skills: two }, true)).toMatchObject({
			packSkills: two,
			manifestInferred: true,
		});
	});
});
