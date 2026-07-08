import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { reputationInputs, users } from '../db/schema';

export type ReputationInputType = 'skill_published' | 'version_published' | 'report_actioned';

// v1 placeholders, flagged for tuning before launch. Changing a weight later
// does not rewrite history: ledger rows keep the weight they were awarded with.
export const REPUTATION_WEIGHTS: Record<ReputationInputType, number> = {
	skill_published: 10,
	version_published: 2,
	report_actioned: -25,
};

export async function awardReputation(
	db: Db,
	userId: number,
	type: ReputationInputType,
): Promise<void> {
	const weight = REPUTATION_WEIGHTS[type];
	await db.insert(reputationInputs).values({ userId, type, weight });
	await db
		.update(users)
		.set({ reputation: sql`${users.reputation} + ${weight}` })
		.where(eq(users.id, userId));
}
