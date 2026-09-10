import { useEffect, useRef, useState } from 'react';
import type { PublicSkillSummary, Target } from 'skill-schema';
import { getSkills } from '../../lib/api';
import {
	filterSkills,
	matchesFilters,
	type CategoryFilter,
	type DirectoryTab,
	type IntegrationFilter,
	type TypeFilter,
} from '../../lib/filter-skills';
import { paginate } from '../../lib/paginate';
import { useAiSearch } from '../../lib/use-ai-search';
import Row from '../skill/Row';
import DirectoryStatus from './DirectoryStatus';
import FilterSidebar from './FilterSidebar';
import ListHeader from './ListHeader';
import Pagination from './Pagination';
import SearchBox, { type SearchMode } from './SearchBox';

type LoadState =
	| { phase: 'loading' }
	| { phase: 'error'; message: string }
	| { phase: 'ready'; skills: PublicSkillSummary[] };

const SIDEBAR_KEY = 'skillpass:filters-open';

function isTypingTarget(el: EventTarget | null): boolean {
	return el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export default function Directory() {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
	const [query, setQuery] = useState('');
	const [tool, setTool] = useState<Target | 'all'>('all');
	const [category, setCategory] = useState<CategoryFilter>('all');
	const [integration, setIntegration] = useState<IntegrationFilter>('all');
	const [type, setType] = useState<TypeFilter>('all');
	const [tab, setTab] = useState<DirectoryTab>('featured');
	const [mode, setMode] = useState<SearchMode>('keyword');
	const { ai, run: runAiSearch, reset: resetAi } = useAiSearch();
	// Desktop sidebar visibility, persisted. Starts true and reads the stored
	// choice in an effect so the server render and hydration always agree.
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [page, setPage] = useState(1);
	const listTopRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (localStorage.getItem(SIDEBAR_KEY) === '0') setSidebarOpen(false);
	}, []);

	// The kbd hint in the search box promises this.
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === '/' && !isTypingTarget(e.target)) {
				e.preventDefault();
				searchRef.current?.focus();
			}
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, []);

	// Any filter change starts back at page 1.
	useEffect(() => {
		setPage(1);
	}, [query, tool, category, integration, type, tab, mode, ai]);

	useEffect(() => {
		let cancelled = false;
		void getSkills().then((res) => {
			if (cancelled) return;
			setLoad(res.success ? { phase: 'ready', skills: res.data } : { phase: 'error', message: res.error });
		});
		return () => {
			cancelled = true;
		};
	}, []);

	function switchMode(next: SearchMode) {
		setMode(next);
		resetAi();
	}

	function changeQuery(next: string) {
		setQuery(next);
		if (mode === 'ai' && next.trim() === '') resetAi();
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

	const skills = load.phase === 'ready' ? load.skills : [];
	// Keyword mode filters the loaded list; AI mode shows the endpoint's
	// relevance-ranked results with the sidebar facets applied, order intact.
	const matches =
		mode === 'keyword'
			? filterSkills(skills, { query, tool, category, integration, type, tab })
			: (ai.phase === 'ready' ? ai.results : []).filter((s) =>
					matchesFilters(s, { tool, category, integration, type }),
				);
	const paged = paginate(matches, page);

	const sidebar = (closeDrawer: boolean) => (
		<FilterSidebar
			skills={skills}
			category={category}
			onCategoryChange={(value) => {
				setCategory(value);
				if (closeDrawer) setDrawerOpen(false);
			}}
			integration={integration}
			onIntegrationChange={(value) => {
				setIntegration(value);
				if (closeDrawer) setDrawerOpen(false);
			}}
			type={type}
			onTypeChange={(value) => {
				setType(value);
				if (closeDrawer) setDrawerOpen(false);
			}}
			tool={tool}
			onToolChange={setTool}
		/>
	);

	return (
		<>
			<SearchBox
				query={query}
				onQueryChange={changeQuery}
				mode={mode}
				onModeChange={switchMode}
				onSubmitAi={() => void runAiSearch(query)}
				inputRef={searchRef}
			/>

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
					{sidebar(true)}
				</div>

				<div className="min-w-0 flex-1">
					<ListHeader
						tab={tab}
						onTabChange={setTab}
						filtersOpen={sidebarOpen || drawerOpen}
						onToggleFilters={toggleFilters}
						topRef={listTopRef}
					/>

					<div className="mt-[6px]">
						{paged.items.map((skill, i) => (
							<Row key={skill.slug} skill={skill} rank={paged.start + i} />
						))}
					</div>

					<Pagination page={paged.page} pageCount={paged.pageCount} onPage={goToPage} />

					<DirectoryStatus
						load={load.phase}
						mode={mode}
						ai={ai}
						skillCount={skills.length}
						matchCount={matches.length}
					/>
				</div>

				<div
					className={`hidden shrink-0 overflow-hidden transition-all duration-300 ease-out md:block ${
						sidebarOpen ? 'ml-9 w-[210px] opacity-100' : 'ml-0 w-0 opacity-0'
					}`}
				>
					<div className="w-[210px]">{sidebar(false)}</div>
				</div>
			</div>
		</>
	);
}
