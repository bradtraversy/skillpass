import type { PermissionKey, PublicPreflight } from 'skill-schema';

export type PermissionDiff = NonNullable<PublicPreflight['diff']>;

// The pre-flight shows one list per direction, merging declared and detected
// changes and naming each key once.
export function changedPermissions(diff: PermissionDiff): {
	added: PermissionKey[];
	removed: PermissionKey[];
} {
	return {
		added: [...new Set([...diff.declared.added, ...diff.detected.added])],
		removed: [...new Set([...diff.declared.removed, ...diff.detected.removed])],
	};
}
