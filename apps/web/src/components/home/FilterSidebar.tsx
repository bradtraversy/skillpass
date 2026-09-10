import { CATEGORIES, INTEGRATIONS, type CategorySlug, type PublicSkillSummary, type Target } from 'skill-schema';
import { CATEGORY_SWATCHES } from '../../lib/categoryTints';
import { facetCounts } from '../../lib/facets';
import type { CategoryFilter, IntegrationFilter, TypeFilter } from '../../lib/filterSkills';

const GROUP_HEADING = 'mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint';

export default function FilterSidebar({
	skills,
	category,
	onCategoryChange,
	integration,
	onIntegrationChange,
	type,
	onTypeChange,
	tool,
	onToolChange,
}: {
	skills: PublicSkillSummary[];
	category: CategoryFilter;
	onCategoryChange: (category: CategoryFilter) => void;
	integration: IntegrationFilter;
	onIntegrationChange: (integration: IntegrationFilter) => void;
	type: TypeFilter;
	onTypeChange: (type: TypeFilter) => void;
	tool: Target | 'all';
	onToolChange: (tool: Target | 'all') => void;
}) {
	const { categories: counts, integrations: integrationCounts, tools, packs: packCount } = facetCounts(skills);

	const rows: { value: CategoryFilter; label: string; count: number; swatch: string }[] = [
		{ value: 'all', label: 'All skills', count: skills.length, swatch: 'bg-accent' },
		...CATEGORIES.filter((c) => counts.has(c.slug)).map((c) => ({
			value: c.slug as CategoryFilter,
			label: c.label,
			count: counts.get(c.slug) ?? 0,
			swatch: CATEGORY_SWATCHES[c.slug as CategorySlug],
		})),
		...(counts.has('uncategorized')
			? [
					{
						value: 'uncategorized' as CategoryFilter,
						label: 'Uncategorized',
						count: counts.get('uncategorized') ?? 0,
						swatch: 'bg-faint',
					},
				]
			: []),
	];

	const typeRows: { value: TypeFilter; label: string; count: number }[] = [
		{ value: 'all', label: 'All skills', count: skills.length },
		{ value: 'skill', label: 'Single skills', count: skills.length - packCount },
		{ value: 'pack', label: 'Workflow packs', count: packCount },
	];

	const integrationRows: { value: IntegrationFilter; label: string; count: number }[] = [
		{ value: 'all', label: 'All skills', count: skills.length },
		...INTEGRATIONS.filter((i) => integrationCounts.has(i.slug)).map((i) => ({
			value: i.slug as IntegrationFilter,
			label: i.label,
			count: integrationCounts.get(i.slug) ?? 0,
		})),
	];

	return (
		<aside>
			<div className={GROUP_HEADING}>Categories</div>
			<nav className="flex flex-col gap-[2px]">
				{rows.map((row) => {
					const active = category === row.value;
					return (
						<button
							key={row.value}
							type="button"
							onClick={() => onCategoryChange(row.value)}
							aria-pressed={active}
							className={`flex items-center justify-between rounded-sm px-[10px] py-[6px] text-left text-[13px] ${
								active ? 'bg-hover font-medium text-text' : 'text-muted hover:bg-hover hover:text-text'
							}`}
						>
							<span className="flex items-center gap-[8px]">
								<span className={`size-2 flex-none rounded-[3px] ${row.swatch}`} aria-hidden="true" />
								<span className={active ? 'text-accent' : undefined}>{row.label}</span>
							</span>
							<span className="font-mono text-[11px] text-faint">{row.count}</span>
						</button>
					);
				})}
			</nav>

			{integrationCounts.size > 0 && (
				<>
					<div className={`mt-7 ${GROUP_HEADING}`}>Works with</div>
					<nav className="flex flex-col gap-[2px]">
						{integrationRows.map((row) => {
							const active = integration === row.value;
							return (
								<button
									key={row.value}
									type="button"
									onClick={() => onIntegrationChange(row.value)}
									aria-pressed={active}
									className={`flex items-center justify-between rounded-sm px-[10px] py-[6px] text-left text-[13px] ${
										active ? 'bg-hover font-medium text-text' : 'text-muted hover:bg-hover hover:text-text'
									}`}
								>
									<span className={active ? 'text-accent' : undefined}>{row.label}</span>
									<span className="font-mono text-[11px] text-faint">{row.count}</span>
								</button>
							);
						})}
					</nav>
				</>
			)}

			{packCount > 0 && (
				<>
					<div className={`mt-7 ${GROUP_HEADING}`}>Type</div>
					<nav className="flex flex-col gap-[2px]">
						{typeRows.map((row) => {
							const active = type === row.value;
							return (
								<button
									key={row.value}
									type="button"
									onClick={() => onTypeChange(row.value)}
									aria-pressed={active}
									className={`flex items-center justify-between rounded-sm px-[10px] py-[6px] text-left text-[13px] ${
										active ? 'bg-hover font-medium text-text' : 'text-muted hover:bg-hover hover:text-text'
									}`}
								>
									<span className={active ? 'text-accent' : undefined}>{row.label}</span>
									<span className="font-mono text-[11px] text-faint">{row.count}</span>
								</button>
							);
						})}
					</nav>
				</>
			)}

			<div className={`mt-7 ${GROUP_HEADING}`}>Tool</div>
			<ToolSelect value={tool} onChange={onToolChange} tools={tools} />
		</aside>
	);
}

function ToolSelect({
	value,
	onChange,
	tools,
}: {
	value: Target | 'all';
	onChange: (value: Target | 'all') => void;
	tools: Target[];
}) {
	return (
		<div className="relative">
			<select
				value={value}
				onChange={(e) => onChange(e.target.value as Target | 'all')}
				className="w-full cursor-pointer appearance-none rounded-sm border border-border-2 bg-transparent py-[6px] pr-7 pl-[11px] text-[12.5px] text-muted hover:bg-hover hover:text-text"
			>
				<option value="all" className="bg-surface text-text">
					All tools
				</option>
				{tools.map((t) => (
					<option key={t} value={t} className="bg-surface text-text">
						{t}
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
