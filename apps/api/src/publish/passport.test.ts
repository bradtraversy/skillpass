import type { ValidationReport } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import type { SubmissionRow, ValidationReportRow } from '../db/schema';
import { buildPassport } from './passport';

const NOW = new Date('2026-07-07T15:00:00Z');

function reportDoc(overrides: Partial<ValidationReport> = {}): ValidationReport {
	return {
		schemaVersion: '0.1',
		status: 'passed',
		riskLevel: 'low',
		sourceHash: 'sha256:abc',
		engineVersion: 'validator-0.1.0',
		permissionsDeclared: ['network.fetch'],
		permissionsDetected: ['network.fetch', 'filesystem.read.project'],
		warnings: [],
		failures: [],
		createdAt: '2026-07-07T14:00:00.000Z',
		...overrides,
	};
}

function reportRow(doc: ValidationReport): ValidationReportRow {
	return {
		id: 9,
		submissionId: 1,
		status: doc.status,
		riskLevel: doc.riskLevel,
		sourceHash: doc.sourceHash,
		engineVersion: doc.engineVersion,
		report: doc,
		createdAt: new Date('2026-07-07T14:00:00Z'),
	};
}

function submissionRow(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
	return {
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
		...overrides,
	};
}

describe('buildPassport', () => {
	it('maps a github report row into a passport with the pinned commit', () => {
		const doc = reportDoc();
		const passport = buildPassport(reportRow(doc), submissionRow(), { now: NOW });

		expect(passport).toEqual({
			schemaVersion: '0.1',
			validationStatus: 'passed',
			riskLevel: 'low',
			permissionsSummary: {
				declared: ['network.fetch'],
				detected: ['network.fetch', 'filesystem.read.project'],
			},
			warningsSummary: [],
			sourceHash: 'sha256:abc',
			resolvedCommitSha: 'abc123',
			engineVersion: 'validator-0.1.0',
			generatedAt: '2026-07-07T15:00:00.000Z',
		});
	});

	it('omits resolvedCommitSha for zip submissions', () => {
		const submission = submissionRow({
			sourceType: 'zip',
			githubUrl: null,
			uploadedZipKey: 'uploads/abc.zip',
			resolvedCommitSha: null,
		});
		const passport = buildPassport(reportRow(reportDoc()), submission, { now: NOW });

		expect('resolvedCommitSha' in passport).toBe(false);
	});

	it('carries report warnings into warningsSummary and passes status/riskLevel through', () => {
		const warnings = [
			{
				code: 'SHELL_SUGGESTION',
				message: 'Skill suggests running shell commands.',
				location: { path: 'SKILL.md', line: 4, snippet: 'run `rm -rf [redacted]`' },
			},
		];
		const doc = reportDoc({ status: 'warning', riskLevel: 'medium', warnings });
		const passport = buildPassport(reportRow(doc), submissionRow(), { now: NOW });

		expect(passport.validationStatus).toBe('warning');
		expect(passport.riskLevel).toBe('medium');
		expect(passport.warningsSummary).toEqual(warnings);
	});

	it('throws when the built passport fails the schema self-check', () => {
		const doc = reportDoc({ sourceHash: '' });
		expect(() => buildPassport(reportRow(doc), submissionRow(), { now: NOW })).toThrow(
			/self-check/,
		);
	});
});
