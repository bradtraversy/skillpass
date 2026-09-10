import type { RefObject } from 'react';
import type { DirectoryTab } from '../../lib/filter-skills';

const TABS = [
	{ value: 'featured', label: 'Featured' },
	{ value: 'new', label: 'Latest' },
] as const;

export default function ListHeader({
	tab,
	onTabChange,
	filtersOpen,
	onToggleFilters,
	topRef,
}: {
	tab: DirectoryTab;
	onTabChange: (tab: DirectoryTab) => void;
	filtersOpen: boolean;
	onToggleFilters: () => void;
	topRef: RefObject<HTMLDivElement | null>;
}) {
	return (
		<div ref={topRef} className="scroll-mt-5 flex items-center gap-[26px] border-b border-border">
			{TABS.map(({ value, label }) => (
				<button
					key={value}
					type="button"
					onClick={() => onTabChange(value)}
					aria-pressed={tab === value}
					className={`-mb-px border-b-2 pb-[13px] ${
						tab === value
							? 'border-accent font-medium text-text'
							: 'border-transparent text-muted hover:text-text'
					}`}
				>
					{label}
				</button>
			))}
			<button
				type="button"
				onClick={onToggleFilters}
				aria-expanded={filtersOpen}
				className="ml-auto flex items-center gap-[7px] rounded-sm border border-border-2 px-[11px] py-[6px] text-[12.5px] text-muted hover:bg-hover hover:text-text"
			>
				<svg
					width="13"
					height="13"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<line x1="4" x2="4" y1="21" y2="14" />
					<line x1="4" x2="4" y1="10" y2="3" />
					<line x1="12" x2="12" y1="21" y2="12" />
					<line x1="12" x2="12" y1="8" y2="3" />
					<line x1="20" x2="20" y1="21" y2="16" />
					<line x1="20" x2="20" y1="12" y2="3" />
					<line x1="2" x2="6" y1="14" y2="14" />
					<line x1="10" x2="14" y1="8" y2="8" />
					<line x1="18" x2="22" y1="16" y2="16" />
				</svg>
				Filters
			</button>
		</div>
	);
}
