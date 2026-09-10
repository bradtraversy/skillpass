import type { AiState } from '../../lib/use-ai-search';
import type { SearchMode } from './SearchBox';

export type LoadPhase = 'loading' | 'error' | 'ready';

// The one line under the list that explains why it is empty (or filling).
export default function DirectoryStatus({
	load,
	mode,
	ai,
	skillCount,
	matchCount,
}: {
	load: LoadPhase;
	mode: SearchMode;
	ai: AiState;
	skillCount: number;
	matchCount: number;
}) {
	const status = statusFor(load, mode, ai, skillCount, matchCount);
	if (!status) return null;
	return (
		<p className={`py-16 text-center text-[13px] ${status.tone === 'fail' ? 'text-fail' : 'text-muted'}`}>
			{status.text}
		</p>
	);
}

function statusFor(
	load: LoadPhase,
	mode: SearchMode,
	ai: AiState,
	skillCount: number,
	matchCount: number,
): { text: string; tone?: 'fail' } | null {
	if (load === 'loading') return { text: 'Loading skills...' };
	if (load === 'error') return { text: "Can't reach the API - is it running?", tone: 'fail' };
	if (skillCount === 0) return { text: 'No skills published yet.' };
	if (mode === 'keyword') return matchCount === 0 ? { text: 'No skills match these filters.' } : null;
	switch (ai.phase) {
		case 'idle':
			return { text: 'Describe what you need and press Enter - AI search matches by meaning, not keywords.' };
		case 'loading':
			return { text: 'Searching...' };
		case 'error':
			return { text: ai.message, tone: 'fail' };
		case 'ready':
			return matchCount === 0 ? { text: 'No skills match that description.' } : null;
	}
}
