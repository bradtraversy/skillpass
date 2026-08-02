import { posix } from 'node:path';
import type { SkillEntry, Target } from 'skill-schema';

export interface PackMemberInstall {
	name: string;
	// Directory inside the snapshot whose subtree becomes <area>/<name>/.
	sourceDir: string;
}

export interface ResolvedPack {
	installs: PackMemberInstall[];
	skipped: string[];
}

// For target T a member resolves to variants[T], falling back to its entry
// when the member supports T (or declares no targets). Members that cannot
// serve T are skipped visibly, never silently.
export function resolvePackMembers(members: SkillEntry[], target: string): ResolvedPack {
	const installs: PackMemberInstall[] = [];
	const skipped: string[] = [];
	for (const member of members) {
		const variant = member.variants?.[target as Target];
		const supportsTarget =
			member.targets === undefined || (member.targets as string[]).includes(target);
		const path = variant ?? (supportsTarget ? member.entry : undefined);
		if (path === undefined) {
			skipped.push(member.name);
		} else {
			installs.push({ name: member.name, sourceDir: posix.dirname(path) });
		}
	}
	return { installs, skipped };
}
