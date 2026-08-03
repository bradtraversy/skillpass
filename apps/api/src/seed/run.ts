import { createDb, type Db } from '../db/client';
import { findSkillBySlug, setSkillCuration } from '../db/skills';
import { users } from '../db/schema';
import { loadEnv } from '../env';
import { curateSkill } from './curate';
import { SEED_LISTINGS } from './listings';

// The account that owns every curated listing (skills.maintainerId). Must be the
// real bradtraversy GitHub id so this promotes the existing signed-in user to
// admin rather than creating a duplicate; attributedTo still credits each source.
const SEED_OWNER = {
	githubId: '5550850',
	username: 'bradtraversy',
	displayName: 'Brad Traversy',
	avatarUrl: 'https://avatars.githubusercontent.com/u/5550850?v=4',
};

async function ensureOwner(db: Db) {
	const [row] = await db
		.insert(users)
		.values({ ...SEED_OWNER, role: 'admin' })
		.onConflictDoUpdate({
			target: users.githubId,
			set: {
				role: 'admin',
				username: SEED_OWNER.username,
				displayName: SEED_OWNER.displayName,
				avatarUrl: SEED_OWNER.avatarUrl,
			},
		})
		.returning();
	return row;
}

async function main() {
	const env = loadEnv();
	const db = createDb(env.DATABASE_URL);

	const owner = await ensureOwner(db);
	console.log(`seed owner: @${owner.username} (id ${owner.id}, role ${owner.role})`);
	console.log(`seeding ${SEED_LISTINGS.length} listings...\n`);

	const counts = { published: 0, skipped: 0, failed: 0 };
	for (const listing of SEED_LISTINGS) {
		const label = listing.githubUrl.split('/').pop() ?? listing.githubUrl;
		const result = await curateSkill(env, db, {
			githubUrl: listing.githubUrl,
			ownerUserId: owner.id,
			attributedTo: listing.attributedTo,
			...(listing.name ? { name: listing.name } : {}),
		});
		counts[result.status]++;
		console.log(
			`  ${result.status.padEnd(9)} ${label}${result.reason ? ` - ${result.reason}` : ''}`,
		);

		// Curation state (featured, display name) applies to published and
		// already-present listings alike, so re-runs converge on the manifest.
		if ((listing.featured || listing.displayName) && result.slug && result.status !== 'failed') {
			const skill = await findSkillBySlug(db, result.slug);
			if (skill) {
				await setSkillCuration(db, skill.id, {
					...(listing.featured ? { featured: true } : {}),
					...(listing.displayName ? { displayName: listing.displayName } : {}),
				});
			}
		}
	}

	console.log(
		`\ndone: ${counts.published} published, ${counts.skipped} skipped, ${counts.failed} failed`,
	);
}

main().catch((err) => {
	console.error('seed failed:', err);
	process.exit(1);
});
