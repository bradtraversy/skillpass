import { z } from 'zod';

// What POST /submissions/:id/publish returns; 7b/7c and the CLI echo it.
export const publishResultSchema = z.object({
	slug: z.string().min(1),
	version: z.string().min(1),
});

export type PublishResult = z.infer<typeof publishResultSchema>;

const MAX_SLUG_LENGTH = 60;

export function slugForSkill(name: string): string {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_SLUG_LENGTH)
		.replace(/-+$/, '');
	return slug || 'skill';
}

// First publish is 1.0.0; each re-publish bumps the major. A manifest-declared
// version field can override this later.
export function nextVersion(current: string | null): string {
	if (!current) {
		return '1.0.0';
	}
	const major = Number.parseInt(current, 10);
	return Number.isNaN(major) ? '1.0.0' : `${major + 1}.0.0`;
}
