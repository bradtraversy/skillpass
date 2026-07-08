import { z } from 'zod';
import { riskLevelSchema, validationStatusSchema } from './enums';
import { permissionKeySchema, type PermissionKey } from './permissions';
import { parseWith, type ParseResult } from './result';

export interface PermissionSetDiff {
	added: PermissionKey[];
	removed: PermissionKey[];
}

// Order-stable: added follows current's order, removed follows previous's.
export function diffPermissions(
	current: PermissionKey[],
	previous: PermissionKey[],
): PermissionSetDiff {
	const currentSet = new Set(current);
	const previousSet = new Set(previous);
	return {
		added: current.filter((key) => !previousSet.has(key)),
		removed: previous.filter((key) => !currentSet.has(key)),
	};
}

const permissionSetDiffSchema = z.strictObject({
	added: z.array(permissionKeySchema),
	removed: z.array(permissionKeySchema),
});

// What GET /skills/:slug/:version/preflight returns; the feature-9 CLI renders
// the same object. diff is null for the first published version.
export const publicPreflightSchema = z.strictObject({
	version: z.string().min(1),
	validationStatus: validationStatusSchema,
	riskLevel: riskLevelSchema,
	sourceHash: z.string().min(1),
	sourceVerified: z.boolean(),
	resolvedCommitSha: z.string().min(1).nullable(),
	generatedAt: z.iso.datetime(),
	permissions: z.strictObject({
		declared: z.array(permissionKeySchema),
		detected: z.array(permissionKeySchema),
	}),
	diff: z
		.strictObject({
			previousVersion: z.string().min(1),
			declared: permissionSetDiffSchema,
			detected: permissionSetDiffSchema,
		})
		.nullable(),
	blocked: z.boolean(),
	blockedReason: z.string().min(1).nullable(),
});

export type PublicPreflight = z.infer<typeof publicPreflightSchema>;

export function parsePreflight(input: unknown): ParseResult<PublicPreflight> {
	return parseWith(publicPreflightSchema, input);
}
