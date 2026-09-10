import type { RefObject } from 'react';

export type SearchMode = 'keyword' | 'ai';

const MODES = [
	{ value: 'keyword', label: 'Keyword' },
	{ value: 'ai', label: 'AI' },
] as const;

export default function SearchBox({
	query,
	onQueryChange,
	mode,
	onModeChange,
	onSubmitAi,
	inputRef,
}: {
	query: string;
	onQueryChange: (query: string) => void;
	mode: SearchMode;
	onModeChange: (mode: SearchMode) => void;
	onSubmitAi: () => void;
	inputRef: RefObject<HTMLInputElement | null>;
}) {
	return (
		<div className="mx-auto mt-[30px] flex max-w-[620px] items-center gap-3 rounded-full border border-border-2 bg-surface px-5 py-[14px] focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--ring)]">
			<svg
				width="19"
				height="19"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="shrink-0 text-faint"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
			</svg>
			<input
				ref={inputRef}
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
				onKeyDown={(e) => {
					if (mode === 'ai' && e.key === 'Enter') onSubmitAi();
				}}
				placeholder={
					mode === 'ai'
						? 'Describe what you need, then press Enter...'
						: 'Search skills, tools, permissions, or maintainers...'
				}
				className="flex-1 bg-transparent text-[15.5px] text-text outline-none placeholder:text-faint"
				aria-label="Search skills"
			/>
			<div className="flex shrink-0 items-center gap-[3px] rounded-full border border-border-2 p-[3px]">
				{MODES.map(({ value, label }) => (
					<button
						key={value}
						type="button"
						onClick={() => onModeChange(value)}
						aria-pressed={mode === value}
						className={`rounded-full px-[9px] py-[3px] text-[11.5px] ${
							mode === value ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:text-text'
						}`}
					>
						{label}
					</button>
				))}
			</div>
			<kbd className="rounded-[5px] border border-border-2 px-[6px] py-[2px] font-mono text-[11px] text-muted">
				/
			</kbd>
		</div>
	);
}
