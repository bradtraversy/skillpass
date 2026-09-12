import { and, eq, isNull } from 'drizzle-orm';
import { skills } from '../db/schema';
import { setSkillIntegrations } from '../db/skills';
import { classifyIntegrations } from '../review/classify-integrations';
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
			.where(and(eq(skills.status, 'published'), isNull(skills.integrations))),
	]);

	console.log(`${rows.length} published skills to classify (${published.length - rows.length} already classified)\n`);

	const distribution = new Map<string, number>();
	let none = 0;
	let failed = 0;
	for (const row of rows) {
		const integrations = await classifyIntegrations(env, { name: row.name, summary: row.summary });
		if (integrations === null) {
			failed++;
			console.log(`  ${row.slug} -> (no answer)`);
			continue;
		}
		await setSkillIntegrations(db, row.id, integrations);
		if (integrations.length === 0) {
			none++;
			console.log(`  ${row.slug} -> (none)`);
		} else {
			for (const slug of integrations) {
				distribution.set(slug, (distribution.get(slug) ?? 0) + 1);
			}
			console.log(`  ${row.slug} -> ${integrations.join(', ')}`);
		}
	}

	console.log(`\ndone: ${rows.length - failed} classified (${none} with none), ${failed} failed`);
	for (const [slug, count] of [...distribution.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${String(count).padStart(4)} ${slug}`);
	}
});
