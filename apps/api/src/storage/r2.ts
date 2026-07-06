import { AwsClient } from 'aws4fetch';
import type { PackageFile } from 'validator';
import type { Env } from '../env';
import type { Result } from '../lib/result';

export const R2_TIMEOUT_MS = 30_000;

// Load-bearing contract: feature 6's worker validates from this document and
// feature 7's source view renders from it. Files are sorted by path, utf8.
export interface SnapshotDocument {
	version: 1;
	files: PackageFile[];
}

export function snapshotDocument(files: PackageFile[]): SnapshotDocument {
	return { version: 1, files };
}

export function snapshotKey(sourceHash: string): string {
	return `snapshots/${sourceHash.replace(/^sha256:/, '')}.json`;
}

// Original uploaded zips, content-addressed by the sha256 of the zip bytes.
export function uploadKey(zipSha256Hex: string): string {
	return `uploads/${zipSha256Hex}.zip`;
}

function objectUrl(env: Env, key: string): string {
	return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;
}

async function putObject(
	env: Env,
	key: string,
	body: string | Uint8Array<ArrayBuffer>,
	contentType: string,
): Promise<Result<null>> {
	const client = new AwsClient({
		accessKeyId: env.R2_ACCESS_KEY_ID,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		service: 's3',
		region: 'auto',
	});
	try {
		const res = await client.fetch(objectUrl(env, key), {
			method: 'PUT',
			headers: { 'Content-Type': contentType },
			body,
			signal: AbortSignal.timeout(R2_TIMEOUT_MS),
		});
		if (!res.ok) {
			return { success: false, error: `r2 put failed (${res.status})` };
		}
		return { success: true, data: null };
	} catch (err) {
		return { success: false, error: `r2 put errored: ${(err as Error).message}` };
	}
}

export async function putJson(env: Env, key: string, value: unknown): Promise<Result<null>> {
	return putObject(env, key, JSON.stringify(value), 'application/json');
}

export async function putBytes(
	env: Env,
	key: string,
	bytes: Uint8Array<ArrayBuffer>,
	contentType: string,
): Promise<Result<null>> {
	return putObject(env, key, bytes, contentType);
}
