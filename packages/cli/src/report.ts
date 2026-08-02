import { fetchPreflight, resolveApiUrl } from './api';
import { renderPreflightReport } from './render';
import type { CommandResult } from './scan';
import type { Styler } from './style';

export interface ReportOptions {
	json?: boolean;
	style?: Styler;
	apiUrl?: string;
	fetchImpl?: typeof fetch;
}

// Exit codes are contract: 0 ok, 1 blocked version, 2 not found/network/API errors.
export async function runReport(ref: string, opts: ReportOptions = {}): Promise<CommandResult> {
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	const apiUrl = resolveApiUrl(opts.apiUrl);
	const fetched = await fetchPreflight(fetchImpl, apiUrl, ref);
	if (!fetched.ok) {
		return fetched.result;
	}

	const exitCode = fetched.preflight.blocked ? 1 : 0;
	if (opts.json) {
		return { lines: [JSON.stringify(fetched.preflight, null, 2)], exitCode };
	}
	return { lines: renderPreflightReport(fetched.detail, fetched.preflight, opts.style), exitCode };
}
