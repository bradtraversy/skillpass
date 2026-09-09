import { useState } from 'react';
import type { ApiResult } from './api';

// One async action at a time: the button disables for the API call plus the
// parent's refetch, surfaces its own error inline, and re-enables either way.
export function useAction(onChange: () => Promise<void>) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	async function run(fn: () => Promise<ApiResult<unknown>>) {
		setBusy(true);
		setError(null);
		try {
			const res = await fn();
			if (res.success) await onChange();
			else setError(res.error);
		} finally {
			setBusy(false);
		}
	}
	return { busy, error, run };
}
