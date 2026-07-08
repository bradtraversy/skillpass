import type { Db } from './client';
import { downloadEvents } from './schema';

export type NewDownloadEvent = typeof downloadEvents.$inferInsert;

export async function recordDownload(db: Db, values: NewDownloadEvent): Promise<void> {
	await db.insert(downloadEvents).values(values);
}
