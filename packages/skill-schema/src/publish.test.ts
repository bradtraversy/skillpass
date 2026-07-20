import { describe, expect, it } from 'vitest';
import { nextVersion, publishResultSchema, slugForSkill } from './publish';

describe('slugForSkill', () => {
	it('kebabs a plain name', () => {
		expect(slugForSkill('Commit Message Writer')).toBe('commit-message-writer');
	});

	it('collapses symbol runs into single hyphens', () => {
		expect(slugForSkill('Hello!! __ World')).toBe('hello-world');
	});

	it('trims leading and trailing separators', () => {
		expect(slugForSkill(' --Weird  Name-- ')).toBe('weird-name');
	});

	it('keeps an already-kebab name unchanged', () => {
		expect(slugForSkill('maintainer-triage')).toBe('maintainer-triage');
	});

	it('caps at 60 chars without a trailing hyphen', () => {
		const slug = slugForSkill(`${'very '.repeat(12)}long skill name`);
		expect(slug.length).toBeLessThanOrEqual(60);
		expect(slug.endsWith('-')).toBe(false);
	});

	it('falls back when nothing survives (non-latin name)', () => {
		expect(slugForSkill('日本語のスキル')).toBe('skill');
	});
});

describe('nextVersion', () => {
	it('starts at 1.0.0', () => {
		expect(nextVersion(null)).toBe('1.0.0');
	});

	it('bumps the major on re-publish', () => {
		expect(nextVersion('1.0.0')).toBe('2.0.0');
		expect(nextVersion('12.0.0')).toBe('13.0.0');
	});

	it('recovers from a malformed stored version', () => {
		expect(nextVersion('abc')).toBe('1.0.0');
	});
});

describe('publishResultSchema', () => {
	it('parses the locked shape', () => {
		expect(publishResultSchema.safeParse({ slug: 'maintainer-triage', version: '1.0.0' }).success).toBe(
			true,
		);
	});

	it('rejects an empty slug', () => {
		expect(publishResultSchema.safeParse({ slug: '', version: '1.0.0' }).success).toBe(false);
	});
});
