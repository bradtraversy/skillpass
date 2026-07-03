import { describe, expect, it } from 'vitest';
import {
	RISK_LEVELS,
	riskLevelSchema,
	SOURCE_TYPES,
	sourceTypeSchema,
	TARGETS,
	targetSchema,
	VALIDATION_STATUSES,
	validationStatusSchema,
} from './enums';

const cases = [
	{ name: 'validationStatusSchema', schema: validationStatusSchema, members: VALIDATION_STATUSES },
	{ name: 'riskLevelSchema', schema: riskLevelSchema, members: RISK_LEVELS },
	{ name: 'targetSchema', schema: targetSchema, members: TARGETS },
	{ name: 'sourceTypeSchema', schema: sourceTypeSchema, members: SOURCE_TYPES },
] as const;

describe.each(cases)('$name', ({ schema, members }) => {
	it.each([...members])('accepts %s', (member) => {
		expect(schema.parse(member)).toBe(member);
	});

	it('rejects an unknown value', () => {
		expect(schema.safeParse('bogus').success).toBe(false);
	});

	it('rejects a non-string', () => {
		expect(schema.safeParse(42).success).toBe(false);
	});
});
