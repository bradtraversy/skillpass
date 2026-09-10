import { AwsClient } from 'aws4fetch';
import type { PackageFile } from 'validator';
import { z } from 'zod';
import type { Env } from '../env';
import type { Result } from '../lib/result';

const R2_TIMEOUT_MS = 30_000;

// Load-bearing contract: feature 6's worker validates from this document and
// feature 7's source view renders from it. Files are sorted by path, utf8.
export interface SnapshotDocument {
	version: 1;
	files: PackageFile[];
}

const snapshotDocumentSchema: z.ZodType<SnapshotDocument> = z.object({
	version: z.literal(1),
	files: z.array(z.object({ path: z.string(), content: z.string() })),
});

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

function awsClient(env: Env): AwsClient {
	return new AwsClient({
		accessKeyId: env.R2_ACCESS_KEY_ID,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		service: 's3',
		region: 'auto',
	});
}

async function putObject(
	env: Env,
	key: string,
	body: string | Uint8Array<ArrayBuffer>,
	contentType: string,
): Promise<Result<null>> {
	try {
		const res = await awsClient(env).fetch(objectUrl(env, key), {
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

// Exact-match error for a GET of a key that does not exist; the worker treats
// it as terminal (no retry) unlike transport errors.
export const R2_MISSING = 'r2 object missing';

export async function getJson(env: Env, key: string): Promise<Result<unknown>> {
	let text: string;
	try {
		const res = await awsClient(env).fetch(objectUrl(env, key), {
			method: 'GET',
			signal: AbortSignal.timeout(R2_TIMEOUT_MS),
		});
		if (res.status === 404) {
			return { success: false, error: R2_MISSING };
		}
		if (!res.ok) {
			return { success: false, error: `r2 get failed (${res.status})` };
		}
		text = await res.text();
	} catch (err) {
		return { success: false, error: `r2 get errored: ${(err as Error).message}` };
	}
	try {
		return { success: true, data: JSON.parse(text) as unknown };
	} catch {
		return { success: false, error: 'r2 object is not valid JSON' };
	}
}

export async function getSnapshotDocument(env: Env, key: string): Promise<Result<SnapshotDocument>> {
	const fetched = await getJson(env, key);
	if (!fetched.success) {
		return fetched;
	}
	const parsed = snapshotDocumentSchema.safeParse(fetched.data);
	if (!parsed.success) {
		return { success: false, error: 'snapshot document has an unexpected shape' };
	}
	return { success: true, data: parsed.data };
}
