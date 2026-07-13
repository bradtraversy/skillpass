import { useEffect, useState } from 'react';
import type { PublicSkillSummary, Target, ValidationStatus } from 'skill-schema';
import { getSkills } from '../../lib/api';
import { filterSkills } from '../../lib/filterSkills';
import Row from '../skill/Row';

const VERDICT_OPTIONS: { value: ValidationStatus | 'all'; label: string }[] = [
	{ value: 'all', label: 'Verdict' },
	{ value: 'passed', label: 'Passed' },
	{ value: 'warning', label: 'Warning' },
	{ value: 'failed', label: 'Failed' },
];

type LoadState =
	| { phase: 'loading' }
	| { phase: 'error'; message: string }
	| { phase: 'ready'; skills: PublicSkillSummary[] };

export default function Directory() {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
	const [query, setQuery] = useState('');
	const [verdict, setVerdict] = useState<ValidationStatus | 'all'>('all');
	const [tool, setTool] = useState<Target | 'all'>('all');

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
	const tools = Array.from(new Set(skills.flatMap((s) => s.targets))).sort();
	// Tabs are deferred at launch scale; show all, newest-first. The Featured/Verified
	// filters stay in filterSkills for when the catalog is large enough to need them.
	const matches = filterSkills(skills, { query, verdict, tool, tab: 'new' });

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

			<div className="mt-[86px] flex items-center gap-[26px] border-b border-border">
				<span className="-mb-px border-b-2 border-accent pb-[13px] font-medium text-text">
					Latest
				</span>
				<div className="ml-auto flex gap-2 pb-2">
					<FilterSelect
						value={verdict}
						onChange={(value) => setVerdict(value as ValidationStatus | 'all')}
						options={VERDICT_OPTIONS}
					/>
					<FilterSelect
						value={tool}
						onChange={(value) => setTool(value as Target | 'all')}
						options={[{ value: 'all', label: 'Tool' }, ...tools.map((t) => ({ value: t, label: t }))]}
					/>
				</div>
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
