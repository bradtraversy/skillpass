import { useCallback, useRef, useState } from 'react';
import type { PublicSkillSummary } from 'skill-schema';
import { searchSkills } from './api';
import { latestOnly } from './latest';

export type AiState =
	| { phase: 'idle' }
	| { phase: 'loading' }
	| { phase: 'error'; message: string }
	| { phase: 'ready'; results: PublicSkillSummary[] };

// One AI search at a time: a second Enter while loading is ignored, and a
// response that arrives after a newer request started is dropped, so the
// rate-limited endpoint never paints stale results over fresh ones.
export function useAiSearch() {
	const [ai, setAi] = useState<AiState>({ phase: 'idle' });
	const requests = useRef(latestOnly());
	// A ref, not state: a second Enter can land before React re-renders.
	const inFlight = useRef(false);

	const run = useCallback(async (query: string) => {
		const q = query.trim();
		if (!q || inFlight.current) return;
		inFlight.current = true;
		const token = requests.current.start();
		setAi({ phase: 'loading' });
		try {
			const res = await searchSkills(q);
			if (!requests.current.isCurrent(token)) return;
			setAi(
				res.success
					? { phase: 'ready', results: res.data }
					: {
							phase: 'error',
							message:
								res.status === 429 ? 'Slow down a moment, then try again.' : 'AI search is unavailable right now.',
						},
			);
		} finally {
			inFlight.current = false;
		}
	}, []);

	const reset = useCallback(() => {
		requests.current.start();
		setAi({ phase: 'idle' });
	}, []);

	return { ai, run, reset };
}
