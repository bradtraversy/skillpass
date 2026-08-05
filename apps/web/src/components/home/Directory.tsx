import { useEffect, useRef, useState } from 'react';
import type { PublicSkillSummary, Target } from 'skill-schema';
import { getSkills, searchSkills } from '../../lib/api';
import {
	filterSkills,
	matchesFilters,
	type CategoryFilter,
	type DirectoryTab,
	type IntegrationFilter,
	type TypeFilter,
} from '../../lib/filterSkills';
import { pageItems, paginate } from '../../lib/paginate';
import Row from '../skill/Row';
import FilterSidebar from './FilterSidebar';

type LoadState =
	| { phase: 'loading' }
	| { phase: 'error'; message: string }
	| { phase: 'ready'; skills: PublicSkillSummary[] };

type SearchMode = 'keyword' | 'ai';

type AiState =
	| { phase: 'idle' }
	| { phase: 'loading' }
	| { phase: 'error'; message: string }
	| { phase: 'ready'; results: PublicSkillSummary[] };

const SIDEBAR_KEY = 'skillpass:filters-open';

export default function Directory() {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
	const [query, setQuery] = useState('');
	const [tool, setTool] = useState<Target | 'all'>('all');
	const [category, setCategory] = useState<CategoryFilter>('all');
	const [integration, setIntegration] = useState<IntegrationFilter>('all');
	const [type, setType] = useState<TypeFilter>('all');
	const [tab, setTab] = useState<DirectoryTab>('featured');
	const [mode, setMode] = useState<SearchMode>('keyword');
	const [ai, setAi] = useState<AiState>({ phase: 'idle' });
	// Desktop sidebar visibility, persisted. Starts true and reads the stored
	// choice in an effect so the server render and hydration always agree.
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [page, setPage] = useState(1);
	const listTopRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (localStorage.getItem(SIDEBAR_KEY) === '0') setSidebarOpen(false);
	}, []);

	// Any filter change starts back at page 1.
	useEffect(() => {
		setPage(1);
	}, [query, tool, category, integration, type, tab, mode, ai]);

	function switchMode(next: SearchMode) {
		setMode(next);
		setAi({ phase: 'idle' });
	}

	async function runAiSearch() {
		const q = query.trim();
		if (!q) return;
		setAi({ phase: 'loading' });
		const res = await searchSkills(q);
		if (res.success) {
			setAi({ phase: 'ready', results: res.data });
		} else {
			setAi({
				phase: 'error',
				message:
					res.status === 429
						? 'Slow down a moment, then try again.'
						: 'AI search is unavailable right now.',
			});
		}
	}

	function goToPage(next: number) {
		setPage(next);
		listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function toggleFilters() {
		if (window.matchMedia('(min-width: 768px)').matches) {
			const next = !sidebarOpen;
			setSidebarOpen(next);
			localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
		} else {
			setDrawerOpen((open) => !open);
		}
	}

	useEffect(() => {
		let cancelled = false;
		void getSkills().then((res) => {
			if (cancelled) return;
			setLoad(
				res.success
					? { phase: 'ready', skills: res.data }
					: { phase: 'error', message: res.error },
			);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const skills = load.phase === 'ready' ? load.skills : [];
	// Keyword mode filters the loaded list; AI mode shows the endpoint's
	// relevance-ranked results with the sidebar facets applied, order intact.
	const matches =
		mode === 'keyword'
			? filterSkills(skills, { query, verdict: 'all', tool, category, integration, type, tab })
			: (ai.phase === 'ready' ? ai.results : []).filter((s) =>
					matchesFilters(s, { verdict: 'all', tool, category, integration, type }),
				);
	const paged = paginate(matches, page);

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
					onChange={(e) => {
						setQuery(e.target.value);
						if (mode === 'ai' && e.target.value.trim() === '') setAi({ phase: 'idle' });
					}}
					onKeyDown={(e) => {
						if (mode === 'ai' && e.key === 'Enter') void runAiSearch();
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
					{(
						[
							{ value: 'keyword', label: 'Keyword' },
							{ value: 'ai', label: 'AI' },
						] as const
					).map(({ value, label }) => (
						<button
							key={value}
							type="button"
							onClick={() => switchMode(value)}
							aria-pressed={mode === value}
							className={`rounded-full px-[9px] py-[3px] text-[11.5px] ${
								mode === value
									? 'bg-accent-soft font-medium text-accent'
									: 'text-muted hover:text-text'
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

			<div className="mt-5 text-center font-mono text-xs text-faint">
				<b className="font-medium text-muted">{load.phase === 'ready' ? skills.length : '-'}</b>{' '}
				{skills.length === 1 ? 'skill' : 'skills'} published
				<span className="mx-[10px] text-border-2">·</span>
				every version validated
				<span className="mx-[10px] text-border-2">·</span>
				same engine in the <span className="text-accent">skillpass</span> CLI
			</div>

			<div className="mt-[56px] flex items-start">
				<div
					className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
						drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
					}`}
					onClick={() => setDrawerOpen(false)}
					aria-hidden="true"
				/>
				<div
					className={`fixed inset-y-0 right-0 z-50 w-[250px] overflow-y-auto border-l border-border bg-bg p-5 transition-transform duration-300 ease-out md:hidden ${
						drawerOpen ? 'translate-x-0' : 'translate-x-full'
					}`}
				>
					<FilterSidebar
						skills={skills}
						category={category}
						onCategoryChange={(value) => {
							setCategory(value);
							setDrawerOpen(false);
						}}
						integration={integration}
						onIntegrationChange={(value) => {
							setIntegration(value);
							setDrawerOpen(false);
						}}
						type={type}
						onTypeChange={(value) => {
							setType(value);
							setDrawerOpen(false);
						}}
						tool={tool}
						onToolChange={setTool}
					/>
				</div>

				<div className="min-w-0 flex-1">
					<div ref={listTopRef} className="scroll-mt-5 flex items-center gap-[26px] border-b border-border">
						{(
							[
								{ value: 'featured', label: 'Featured' },
								{ value: 'new', label: 'Latest' },
							] as const
						).map(({ value, label }) => (
							<button
								key={value}
								type="button"
								onClick={() => setTab(value)}
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
							onClick={toggleFilters}
							aria-expanded={sidebarOpen || drawerOpen}
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

					<div className="mt-[6px]">
						{paged.items.map((skill, i) => (
							<Row key={skill.slug} skill={skill} rank={paged.start + i} />
						))}
					</div>

					{paged.pageCount > 1 && (
						<nav
							aria-label="Pagination"
							className="mt-7 mb-16 flex items-center justify-center gap-[6px] font-mono text-[12.5px]"
						>
							<button
								type="button"
								onClick={() => goToPage(paged.page - 1)}
								disabled={paged.page === 1}
								className="rounded-sm border border-border-2 px-[10px] py-[6px] text-muted hover:bg-hover hover:text-text disabled:pointer-events-none disabled:opacity-40"
							>
								Prev
							</button>
							{pageItems(paged.page, paged.pageCount).map((item, i) =>
								item === 'gap' ? (
									<span key={`gap-${i}`} className="px-[4px] text-faint">
										...
									</span>
								) : (
									<button
										key={item}
										type="button"
										onClick={() => goToPage(item)}
										aria-current={item === paged.page ? 'page' : undefined}
										className={`min-w-[34px] rounded-sm border px-[9px] py-[6px] ${
											item === paged.page
												? 'border-accent-line bg-accent-soft font-medium text-accent'
												: 'border-border-2 text-muted hover:bg-hover hover:text-text'
										}`}
									>
										{item}
									</button>
								),
							)}
							<button
								type="button"
								onClick={() => goToPage(paged.page + 1)}
								disabled={paged.page === paged.pageCount}
								className="rounded-sm border border-border-2 px-[10px] py-[6px] text-muted hover:bg-hover hover:text-text disabled:pointer-events-none disabled:opacity-40"
							>
								Next
							</button>
						</nav>
					)}

					{load.phase === 'loading' && (
						<p className="py-16 text-center text-[13px] text-muted">Loading skills...</p>
					)}
					{load.phase === 'error' && (
						<p className="py-16 text-center text-[13px] text-fail">
							Can't reach the API - is it running?
						</p>
					)}
					{load.phase === 'ready' && skills.length === 0 && (
						<p className="py-16 text-center text-[13px] text-muted">No skills published yet.</p>
					)}
					{mode === 'keyword' && load.phase === 'ready' && skills.length > 0 && matches.length === 0 && (
						<p className="py-16 text-center text-[13px] text-muted">
							No skills match these filters.
						</p>
					)}
					{mode === 'ai' && ai.phase === 'idle' && (
						<p className="py-16 text-center text-[13px] text-muted">
							Describe what you need and press Enter - AI search matches by meaning, not
							keywords.
						</p>
					)}
					{mode === 'ai' && ai.phase === 'loading' && (
						<p className="py-16 text-center text-[13px] text-muted">Searching...</p>
					)}
					{mode === 'ai' && ai.phase === 'error' && (
						<p className="py-16 text-center text-[13px] text-fail">{ai.message}</p>
					)}
					{mode === 'ai' && ai.phase === 'ready' && matches.length === 0 && (
						<p className="py-16 text-center text-[13px] text-muted">
							No skills match that description.
						</p>
					)}
				</div>

				<div
					className={`hidden shrink-0 overflow-hidden transition-all duration-300 ease-out md:block ${
						sidebarOpen ? 'ml-9 w-[210px] opacity-100' : 'ml-0 w-0 opacity-0'
					}`}
				>
					<div className="w-[210px]">
						<FilterSidebar
							skills={skills}
							category={category}
							onCategoryChange={setCategory}
							integration={integration}
							onIntegrationChange={setIntegration}
							type={type}
							onTypeChange={setType}
							tool={tool}
							onToolChange={setTool}
						/>
					</div>
				</div>
			</div>
		</>
	);
}
