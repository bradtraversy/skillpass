import type { ApiResult } from './api';

// Server-side head metadata fetches must never hold a page hostage to a slow
// API; the page still renders with URL-derived copy.
export const HEAD_FETCH_TIMEOUT_MS = 4000;

// One head fetch for a server-rendered page: the data on success, null on any
// failure, and the response marked 404 only when the API said the thing does
// not exist (an outage keeps the 200 so the shell still serves).
export async function headFetch<T>(
	response: { status?: number },
	run: (init: RequestInit) => Promise<ApiResult<T>>,
): Promise<T | null> {
	const result = await run({ signal: AbortSignal.timeout(HEAD_FETCH_TIMEOUT_MS) });
	if (result.success) return result.data;
	if (result.status === 404) response.status = 404;
	return null;
}
