import { fileURLToPath } from 'node:url';
import { and, eq, isNull, or } from 'drizzle-orm';
import { createDb, type Db } from '../db/client';
import { skills } from '../db/schema';
import { setSkillDisplayCopy } from '../db/skills';
import { loadEnv, type Env } from '../env';
import { generateDisplayCopy } from '../review/display-copy';

async function main() {
	const env: Env = loadEnv();
	const db: Db = createDb(env.DATABASE_URL);

	if (!env.ANTHROPIC_API_KEY) {
		console.log('ANTHROPIC_API_KEY is not set; nothing to generate.');
		return;
	}

	const [published, rows] = await Promise.all([
		db.select({ id: skills.id }).from(skills).where(eq(skills.status, 'published')),
		db
			.select({ id: skills.id, slug: skills.slug, name: skills.name, summary: skills.summary })
			.from(skills)
			.where(
				and(
					eq(skills.status, 'published'),
					or(isNull(skills.displayName), isNull(skills.tagline)),
				),
			),
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((err) => {
		console.error('backfill failed:', err);
		process.exit(1);
	});
}
