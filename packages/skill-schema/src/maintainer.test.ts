import { describe, expect, it } from 'vitest';
import {
	maintainerReportSchema,
	maintainerSkillSchema,
	type MaintainerReport,
	type MaintainerSkill,
} from './maintainer';

const skill: MaintainerSkill = {
	slug: 'smoke-clean',
	name: 'Smoke Clean',
	status: 'published',
	version: '1.0.0',
	validationStatus: 'passed',
	riskLevel: 'low',
	updatedAt: '2026-08-01T10:00:00.000Z',
};

const report: MaintainerReport = {
	id: 3,
	skill: { slug: 'smoke-clean', name: 'Smoke Clean' },
	reason: 'spammy install instructions',
	status: 'open',
	createdAt: '2026-08-01T10:00:00.000Z',
};

describe('maintainerSkillSchema', () => {
	it('parses a valid row', () => {
		expect(maintainerSkillSchema.parse(skill)).toEqual(skill);
	});

	it('allows a version-less unvalidated row', () => {
		const bare = { ...skill, version: null, validationStatus: null, riskLevel: null };
		expect(maintainerSkillSchema.parse(bare)).toEqual(bare);
	});

	it('rejects an unknown status', () => {
		expect(maintainerSkillSchema.safeParse({ ...skill, status: 'archived' }).success).toBe(false);
	});
});

describe('maintainerReportSchema', () => {
	it('parses a valid report', () => {
		expect(maintainerReportSchema.parse(report)).toEqual(report);
	});

	it('rejects reporter fields - maintainers never see who filed', () => {
		const leaked = { ...report, reporter: { username: 'someone' } };
		expect(maintainerReportSchema.safeParse(leaked).success).toBe(false);
	});
});
