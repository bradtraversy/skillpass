import {
	publicPreflightSchema,
	publicSkillDetailSchema,
	publicSkillListSchema,
	publicSkillSummarySchema,
	publicSkillVersionSchema,
	skillPassportSchema,
} from 'skill-schema';
import { describe, expect, it } from 'vitest';
import {
	DETAIL_FIELDS,
	EXAMPLE_DETAIL,
	EXAMPLE_PASSPORT,
	EXAMPLE_PREFLIGHT,
	EXAMPLE_SUMMARY,
	EXAMPLE_VERSION,
	PASSPORT_FIELDS,
	PREFLIGHT_FIELDS,
	SUMMARY_FIELDS,
	VERSION_FIELDS,
	type FieldDoc,
} from './api-docs';

const names = (fields: FieldDoc[]) => fields.map((field) => field.name);
const summaryKeys = Object.keys(publicSkillSummarySchema.shape);

describe('api docs field tables', () => {
	it('document every passport field and nothing else', () => {
		expect(names(PASSPORT_FIELDS)).toEqual(Object.keys(skillPassportSchema.shape));
	});

	it('document every summary field and nothing else', () => {
		expect(names(SUMMARY_FIELDS)).toEqual(summaryKeys);
	});

	it('document exactly the fields detail adds to the summary', () => {
		const detailOnly = Object.keys(publicSkillDetailSchema.shape).filter((key) => !summaryKeys.includes(key));
		expect(names(DETAIL_FIELDS)).toEqual(detailOnly);
	});

	it('document every version entry field and nothing else', () => {
		expect(names(VERSION_FIELDS)).toEqual(Object.keys(publicSkillVersionSchema.shape));
	});

	it('document every pre-flight field and nothing else', () => {
		expect(names(PREFLIGHT_FIELDS)).toEqual(Object.keys(publicPreflightSchema.shape));
	});

	it('give every field a type and a description', () => {
		for (const field of [
			...PASSPORT_FIELDS,
			...SUMMARY_FIELDS,
			...DETAIL_FIELDS,
			...VERSION_FIELDS,
			...PREFLIGHT_FIELDS,
		]) {
			expect(field.type, field.name).not.toBe('');
			expect(field.description, field.name).not.toBe('');
		}
	});
});

describe('api docs examples', () => {
	it('parse with the real read schemas', () => {
		expect(skillPassportSchema.safeParse(EXAMPLE_PASSPORT).success).toBe(true);
		expect(publicSkillVersionSchema.safeParse(EXAMPLE_VERSION).success).toBe(true);
		expect(publicSkillListSchema.safeParse([EXAMPLE_SUMMARY]).success).toBe(true);
		expect(publicSkillDetailSchema.safeParse(EXAMPLE_DETAIL).success).toBe(true);
		expect(publicPreflightSchema.safeParse(EXAMPLE_PREFLIGHT).success).toBe(true);
	});
});
