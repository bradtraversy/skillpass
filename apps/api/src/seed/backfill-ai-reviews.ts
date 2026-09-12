import { eq } from 'drizzle-orm';
import { findAiReviewByHash } from '../db/reviews';
import { skills, skillVersions, validationReports } from '../db/schema';
import { ensureAiReview } from '../review/ensure';
import { runBackfill } from './runner';

runBackfill(import.meta.url, async (env, db) => {
	if (!env.ANTHROPIC_API_KEY) {
		console.log('ANTHROPIC_API_KEY is not set; nothing to generate.');
		return;
	}

	const rows = await db
		.select({
			slug: skills.slug,
			sourceHash: skillVersions.sourceHash,
			snapshotKey: skillVersions.snapshotKey,
			report: validationReports.report,
		})
		.from(skills)
		.innerJoin(skillVersions, eq(skills.latestVersionId, skillVersions.id))
		.innerJoin(validationReports, eq(validationReports.submissionId, skillVersions.submissionId))
		.where(eq(skills.status, 'published'));

	console.log(`${rows.length} published skills to review\n`);

	const counts = { generated: 0, existing: 0, skipped: 0 };
	for (const row of rows) {
		if (await findAiReviewByHash(db, row.sourceHash)) {
			counts.existing++;
			continue;
		}
		await ensureAiReview(env, db, row.sourceHash, row.snapshotKey, row.report);
		const stored = await findAiReviewByHash(db, row.sourceHash);
		if (stored) {
			counts.generated++;
			console.log(`  generated ${row.slug} - ${stored.review.verdict}`);
		} else {
			counts.skipped++;
			console.log(`  skipped   ${row.slug} - no review produced`);
		}
	}

	console.log(`\ndone: ${counts.generated} generated, ${counts.existing} already had one, ${counts.skipped} skipped`);
});
