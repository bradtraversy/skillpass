import { eq } from 'drizzle-orm';
import type { PublicUser } from 'skill-schema';
import type { Db } from './client';
import { users, type UserRow } from './schema';

export interface GithubProfile {
	githubId: string;
	username: string;
	displayName: string;
	avatarUrl: string;
}

export function publicUser(row: UserRow): PublicUser {
	return {
		id: row.id,
		username: row.username,
		displayName: row.displayName,
		avatarUrl: row.avatarUrl,
		role: row.role,
		reputation: row.reputation,
		createdAt: row.createdAt.toISOString(),
	};
}

export async function findById(db: Db, id: number): Promise<UserRow | undefined> {
	const [row] = await db.select().from(users).where(eq(users.id, id));
	return row;
}

export async function findByUsername(db: Db, username: string): Promise<UserRow | undefined> {
	const [row] = await db.select().from(users).where(eq(users.username, username));
	return row;
}

// Identity is githubId; profile fields refresh on every sign-in so GitHub
// renames stay current.
export async function upsertFromGithub(db: Db, profile: GithubProfile): Promise<UserRow> {
	const [row] = await db
		.insert(users)
		.values(profile)
		.onConflictDoUpdate({
			target: users.githubId,
			set: {
				username: profile.username,
				displayName: profile.displayName,
				avatarUrl: profile.avatarUrl,
			},
		})
		.returning();
	return row;
}
