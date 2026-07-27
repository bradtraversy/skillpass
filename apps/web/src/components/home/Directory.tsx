import { useEffect, useState } from 'react';
import type { PublicSkillSummary, Target } from 'skill-schema';
import { getSkills } from '../../lib/api';
import { filterSkills, type CategoryFilter, type IntegrationFilter } from '../../lib/filterSkills';
import Row from '../skill/Row';
import FilterSidebar from './FilterSidebar';

type LoadState =
	| { phase: 'loading' }
	| { phase: 'error'; message: string }
	| { phase: 'ready'; skills: PublicSkillSummary[] };

const SIDEBAR_KEY = 'skillpass:filters-open';

export default function Directory() {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
	const [query, setQuery] = useState('');
	const [tool, setTool] = useState<Target | 'all'>('all');
	const [category, setCategory] = useState<CategoryFilter>('all');
	const [integration, setIntegration] = useState<IntegrationFilter>('all');
	// Desktop sidebar visibility, persisted. Starts true and reads the stored
	// choice in an effect so the server render and hydration always agree.
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [drawerOpen, setDrawerOpen] = useState(false);

	useEffect(() => {
		if (localStorage.getItem(SIDEBAR_KEY) === '0') setSidebarOpen(false);
	}, []);

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
	// Tabs are deferred at launch scale; show all, newest-first. The Featured/Verified
	// filters stay in filterSkills for when the catalog is large enough to need them.
	const matches = filterSkills(skills, {
		query,
		verdict: 'all',
		tool,
		category,
		integration,
		tab: 'new',
	});

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
						tool={tool}
						onToolChange={setTool}
					/>
				</div>

				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-[26px] border-b border-border">
						<span className="-mb-px border-b-2 border-accent pb-[13px] font-medium text-text">
							Latest
						</span>
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
						{matches.map((skill, i) => (
							<Row key={skill.slug} skill={skill} rank={i + 1} />
						))}
					</div>

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
					{load.phase === 'ready' && skills.length > 0 && matches.length === 0 && (
						<p className="py-16 text-center text-[13px] text-muted">
							No skills match these filters.
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
							tool={tool}
							onToolChange={setTool}
						/>
					</div>
				</div>
			</div>
		</>
	);
}
