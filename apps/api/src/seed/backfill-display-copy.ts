import { and, eq, isNull, or } from 'drizzle-orm';
import { skills } from '../db/schema';
import { setSkillDisplayCopy } from '../db/skills';
import { generateDisplayCopy } from '../review/display-copy';
import { runBackfill } from './runner';

runBackfill(import.meta.url, async (env, db) => {
	if (!env.ANTHROPIC_API_KEY) {
		console.log('ANTHROPIC_API_KEY is not set; nothing to generate.');
		return;
	}

	const [published, rows] = await Promise.all([
		db.select({ id: skills.id }).from(skills).where(eq(skills.status, 'published')),
		db
			.select({ id: skills.id, slug: skills.slug, name: skills.name, summary: skills.summary })
			.from(skills)
			.where(and(eq(skills.status, 'published'), or(isNull(skills.displayName), isNull(skills.tagline)))),
	]);

	console.log(
		`${rows.length} published skills to copy-write (${published.length - rows.length} already have display copy)\n`,
	);

	let failed = 0;
	for (const row of rows) {
		const copy = await generateDisplayCopy(env, { name: row.name, summary: row.summary });
		if (copy) {
			await setSkillDisplayCopy(db, row.id, copy);
			console.log(`  ${row.slug} -> ${copy.displayName} | ${copy.tagline}`);
		} else {
			failed++;
			console.log(`  ${row.slug} -> (no copy produced)`);
		}
	}

	console.log(`\ndone: ${rows.length - failed} generated, ${failed} failed`);
});
