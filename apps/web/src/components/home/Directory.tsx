import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Skill, Target, Verdict } from '../../lib/skills';
import { filterSkills } from '../../lib/filterSkills';

interface Props {
	skills: Skill[];
	/** Server-rendered Row list, filtered client-side by toggling data-slug rows. */
	children: ReactNode;
}

const TABS = ['Trending', 'New', 'Verified', 'Workflow packs'];

const VERDICT_OPTIONS: { value: Verdict | 'all'; label: string }[] = [
	{ value: 'all', label: 'Verdict' },
	{ value: 'passed', label: 'Passed' },
	{ value: 'warning', label: 'Warning' },
	{ value: 'failed', label: 'Failed' },
];

export default function Directory({ skills, children }: Props) {
	const [query, setQuery] = useState('');
	const [verdict, setVerdict] = useState<Verdict | 'all'>('all');
	const [tool, setTool] = useState<Target | 'all'>('all');
	const [activeTab, setActiveTab] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);

	const tools = Array.from(new Set(skills.flatMap((s) => s.targets))).sort();
	const matches = filterSkills(skills, { query, verdict, tool });

	// The rows are static server HTML; show only the ones the filter matches.
	useEffect(() => {
		const visible = new Set(matches.map((s) => s.slug));
		listRef.current?.querySelectorAll<HTMLElement>('[data-slug]').forEach((row) => {
			row.hidden = !visible.has(row.dataset.slug ?? '');
		});
	}, [matches]);

	return (
		<>
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
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search skills, tools, permissions, or maintainers..."
					className="flex-1 bg-transparent text-[15.5px] text-text outline-none placeholder:text-faint"
					aria-label="Search skills"
				/>
				<kbd className="rounded-[5px] border border-border-2 px-[6px] py-[2px] font-mono text-[11px] text-muted">
					/
				</kbd>
			</div>

			<div className="mt-5 text-center font-mono text-xs text-faint">
				<b className="font-medium text-muted">312</b> skills
				<span className="mx-[10px] text-border-2">·</span>
				<b className="font-medium text-muted">1,041</b> versions inspected
				<span className="mx-[10px] text-border-2">·</span>
				<b className="font-medium text-muted">27</b> flagged &amp; held
				<span className="mx-[10px] text-border-2">·</span>
				same engine in the <span className="text-accent">aiskills</span> CLI
			</div>

			<div className="mt-[86px] flex items-center gap-[26px] border-b border-border">
				{TABS.map((tab, i) => (
					<button
						key={tab}
						type="button"
						onClick={() => setActiveTab(i)}
						className={`-mb-px cursor-pointer border-b-2 pb-[13px] font-medium ${
							i === activeTab
								? 'border-accent text-text'
								: 'border-transparent text-muted hover:text-text'
						}`}
					>
						{tab}
					</button>
				))}
				<div className="ml-auto flex gap-2 pb-2">
					<FilterSelect
						value={verdict}
						onChange={(value) => setVerdict(value as Verdict | 'all')}
						options={VERDICT_OPTIONS}
					/>
					<FilterSelect
						value={tool}
						onChange={(value) => setTool(value as Target | 'all')}
						options={[{ value: 'all', label: 'Tool' }, ...tools.map((t) => ({ value: t, label: t }))]}
					/>
				</div>
			</div>

			<div ref={listRef} className="mt-[6px]">
				{children}
			</div>

			{matches.length === 0 && (
				<p className="py-16 text-center text-[13px] text-muted">No skills match these filters.</p>
			)}
		</>
	);
}

function FilterSelect({
	value,
	onChange,
	options,
}: {
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
}) {
	return (
		<div className="relative">
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="cursor-pointer appearance-none rounded-sm border border-border-2 bg-transparent py-[6px] pr-7 pl-[11px] text-[12.5px] text-muted hover:bg-hover hover:text-text"
			>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value} className="bg-surface text-text">
						{opt.label}
					</option>
				))}
			</select>
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="pointer-events-none absolute top-1/2 right-[9px] -translate-y-1/2 text-faint"
				aria-hidden="true"
			>
				<path d="m6 9 6 6 6-6" />
			</svg>
		</div>
	);
}
