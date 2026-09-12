import { eq } from 'drizzle-orm';
import { loadPackageFromFiles, type PackageFile } from 'validator';
import { skills, skillVersions } from '../db/schema';
import { getSnapshotDocument } from '../storage/r2';
import { runBackfill } from './runner';

// Publishes before the declared-version fix were numbered by the counter, so a
// skill that declares 1.4.0 lists as 1.0.0. This renames each latest version
// row to what its snapshot declares; skills that declare nothing keep their
// number. Preview by default, write with --apply.

export function declaredVersionFor(files: PackageFile[], slug: string): string | undefined {
	const pkg = loadPackageFromFiles(files, slug);
	return pkg.manifest.state === 'ok' ? pkg.manifest.data.version : undefined;
}

export type RenamePlan = { action: 'rename'; to: string } | { action: 'skip'; reason: string };

export function planRename(stored: string, declared: string | undefined, siblings: string[]): RenamePlan {
	if (!declared) return { action: 'skip', reason: 'declares no version' };
	if (declared === stored) return { action: 'skip', reason: 'already matches' };
	if (siblings.includes(declared)) return { action: 'skip', reason: `${declared} already exists for this skill` };
	return { action: 'rename', to: declared };
}

runBackfill(import.meta.url, async (env, db) => {
	const apply = process.argv.includes('--apply');
	const rows = await db
		.select({
			skillId: skills.id,
			slug: skills.slug,
			versionId: skillVersions.id,
			version: skillVersions.version,
			snapshotKey: skillVersions.snapshotKey,
		})
		.from(skills)
		.innerJoin(skillVersions, eq(skills.latestVersionId, skillVersions.id));
	console.log(`${rows.length} published skills; ${apply ? 'applying' : 'preview only, pass --apply to write'}\n`);

	const counts = { renamed: 0, skipped: 0, failed: 0 };
	for (const row of rows) {
		const snapshot = await getSnapshotDocument(env, row.snapshotKey);
		if (!snapshot.success) {
			counts.failed++;
			console.log(`  failed   ${row.slug} - snapshot ${snapshot.error}`);
			continue;
		}
		const siblings = await db
			.select({ version: skillVersions.version })
			.from(skillVersions)
			.where(eq(skillVersions.skillId, row.skillId));
		const plan = planRename(
			row.version,
			declaredVersionFor(snapshot.data.files, row.slug),
			siblings.map((s) => s.version).filter((v) => v !== row.version),
		);
		if (plan.action === 'skip') {
			counts.skipped++;
			if (!plan.reason.startsWith('declares no')) console.log(`  skipped  ${row.slug} - ${plan.reason}`);
			continue;
		}
		if (apply) {
			await db.update(skillVersions).set({ version: plan.to }).where(eq(skillVersions.id, row.versionId));
		}
		counts.renamed++;
		console.log(`  ${apply ? 'renamed' : 'would rename'} ${row.slug} ${row.version} -> ${plan.to}`);
	}

	console.log(
		`\ndone: ${counts.renamed} ${apply ? 'renamed' : 'to rename'}, ${counts.skipped} skipped, ${counts.failed} failed`,
	);
});
