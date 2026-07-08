import { z } from 'zod';
import { publicSkillSummarySchema } from './public';
import { parseWith, type ParseResult } from './result';

// What GET /users/:username returns - a maintainer's public face. The skills
// array reuses the directory row shape so the same components render it.
export const publicProfileSchema = z.strictObject({
	username: z.string().min(1),
	displayName: z.string().min(1),
	avatarUrl: z.string().min(1),
	reputation: z.number().int(),
	joinedAt: z.iso.datetime(),
	skills: z.array(publicSkillSummarySchema),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

export function parseProfile(input: unknown): ParseResult<PublicProfile> {
	return parseWith(publicProfileSchema, input);
}
