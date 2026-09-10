import { z } from 'zod';
import { parseWith, type ParseResult } from './result';

export const USER_ROLES = ['user', 'maintainer', 'admin'] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

// What GET /me returns: the signed-in user's public face. The GitHub id never
// travels. A read contract, so unknown keys strip rather than reject.
export const publicUserSchema = z.object({
	id: z.number().int().positive(),
	username: z.string().min(1),
	displayName: z.string().min(1),
	avatarUrl: z.string().min(1),
	role: userRoleSchema,
	reputation: z.number().int(),
	createdAt: z.iso.datetime(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;

export function parsePublicUser(input: unknown): ParseResult<PublicUser> {
	return parseWith(publicUserSchema, input);
}
