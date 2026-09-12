import { and, eq, isNull } from 'drizzle-orm';
import { skills } from '../db/schema';
import { setSkillCategory } from '../db/skills';
import { classifyCategory } from '../review/classify';
import { runBackfill } from './runner';

runBackfill(import.meta.url, async (env, db) => {
	if (!env.ANTHROPIC_API_KEY) {
		console.log('ANTHROPIC_API_KEY is not set; nothing to classify.');
		return;
	}

	const [published, rows] = await Promise.all([
		db.select({ id: skills.id }).from(skills).where(eq(skills.status, 'published')),
		db
			.select({ id: skills.id, slug: skills.slug, name: skills.name, summary: skills.summary })
			.from(skills)
			.where(and(eq(skills.status, 'published'), isNull(skills.category))),
	]);

	console.log(
		`${rows.length} published skills to categorize (${published.length - rows.length} already categorized)\n`,
	);

	const distribution = new Map<string, number>();
	let failed = 0;
	for (const row of rows) {
		const category = await classifyCategory(env, { name: row.name, summary: row.summary });
		if (category) {
			await setSkillCategory(db, row.id, category);
			distribution.set(category, (distribution.get(category) ?? 0) + 1);
			console.log(`  ${row.slug} -> ${category}`);
		} else {
			failed++;
			console.log(`  ${row.slug} -> (no category produced)`);
		}
	}

	console.log(`\ndone: ${rows.length - failed} classified, ${failed} failed`);
	for (const [slug, count] of [...distribution.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${String(count).padStart(4)} ${slug}`);
	}
});
