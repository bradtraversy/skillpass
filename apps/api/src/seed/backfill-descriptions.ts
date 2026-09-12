import { eq } from 'drizzle-orm';
import { loadPackageFromFiles } from 'validator';
import { skills, skillVersions } from '../db/schema';
import { getSnapshotDocument } from '../storage/r2';
import { runBackfill } from './runner';

// A summary is broken when an older parser stored a YAML block-scalar indicator
// (`>`, `>-`, `|-`) or nothing instead of the folded text, or when the old
// line-based inference kept markup, a blockquote marker, or a line cut
// mid-sentence at a wrap.
export function isBrokenSummary(summary: string | null | undefined): boolean {
	const s = (summary ?? '').trim();
	return s.length < 3 || /^[|>][+-]?$/.test(s) || /^>\s/.test(s) || /<\/?[a-zA-Z][^>]*>/.test(s) || /[,;:]$/.test(s);
}

runBackfill(import.meta.url, async (env, db) => {
	const rows = await db
		.select({ id: skills.id, slug: skills.slug, summary: skills.summary, snapshotKey: skillVersions.snapshotKey })
		.from(skills)
		.innerJoin(skillVersions, eq(skills.latestVersionId, skillVersions.id));

	const broken = rows.filter((r) => isBrokenSummary(r.summary));
	console.log(`${rows.length} skills, ${broken.length} with a broken summary\n`);

	const counts = { fixed: 0, unchanged: 0, failed: 0 };
	for (const row of broken) {
		const snapshot = await getSnapshotDocument(env, row.snapshotKey);
		if (!snapshot.success) {
			counts.failed++;
			console.log(`  failed    ${row.slug} - snapshot ${snapshot.error}`);
			continue;
		}
		const pkg = loadPackageFromFiles(snapshot.data.files, row.slug);
		const description = pkg.manifest.state === 'ok' ? pkg.manifest.data.description : undefined;
		if (!description || isBrokenSummary(description)) {
			counts.unchanged++;
			console.log(`  unchanged ${row.slug} - no better description parsed`);
			continue;
		}
		// Display copy was generated from the broken summary; clearing the tagline
		// makes db:backfill-display-copy regenerate it from the repaired one.
		await db
			.update(skills)
			.set({ summary: description, tagline: null, updatedAt: new Date() })
			.where(eq(skills.id, row.id));
		counts.fixed++;
		console.log(`  fixed     ${row.slug} - ${description.slice(0, 60)}...`);
	}

	console.log(`\ndone: ${counts.fixed} fixed, ${counts.unchanged} unchanged, ${counts.failed} failed`);
});
