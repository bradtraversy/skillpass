import { useCallback, useEffect, useState } from 'react';
import type {
	AdminAbuseReport,
	AdminQueue,
	AdminSkillRef,
	AdminSubmission,
	AdminVersionHistory,
	PublicSkillSummary,
} from 'skill-schema';
import {
	flagSkill,
	getAdminQueue,
	getSkillHistory,
	getSkills,
	resolveReport,
	setFeatured,
	setVerified,
	signInUrl,
	unflagSkill,
	type ApiResult,
} from '../../lib/api';
import { timeAgo } from '../../lib/format';

type LoadState =
	| { phase: 'loading' }
	| { phase: 'signedout' }
	| { phase: 'notauth' }
	| { phase: 'error' }
	| { phase: 'ready'; queue: AdminQueue };

const SECTION_HEADING = 'mb-[13px] font-mono text-[11px] uppercase tracking-[0.12em] text-faint';
const CARD = 'rounded-md border border-border bg-surface px-[16px] py-[13px]';
const BTN_BASE =
	'cursor-pointer rounded-sm px-[11px] py-[6px] text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-50';

export default function AdminDashboard() {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });

	const refresh = useCallback(async () => {
		const res = await getAdminQueue();
		if (res.success) setLoad({ phase: 'ready', queue: res.data });
		else if (res.status === 401) setLoad({ phase: 'signedout' });
		else if (res.status === 403) setLoad({ phase: 'notauth' });
		else setLoad({ phase: 'error' });
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	if (load.phase === 'loading') {
		return <p className="py-16 text-center text-[13px] text-muted">Loading the review queue...</p>;
	}
	if (load.phase === 'signedout') {
		return (
			<p className="py-16 text-center text-[13px] text-muted">
				<a href={signInUrl()} className="text-accent hover:underline">
					Sign in with GitHub
				</a>{' '}
				to access the admin queue.
			</p>
		);
	}
	if (load.phase === 'notauth') {
		return (
			<p className="py-16 text-center text-[13px] text-muted">
				You do not have admin access.
			</p>
		);
	}
	if (load.phase === 'error') {
		return (
			<p className="py-16 text-center text-[13px] text-fail">Can't reach the API - is it running?</p>
		);
	}

	const { queue } = load;
	return (
		<div className="flex flex-col gap-[38px] pb-24">
			<section>
				<h2 className={SECTION_HEADING}>Open reports ({queue.reports.length})</h2>
				{queue.reports.length === 0 ? (
					<Empty>No open reports. Nothing to review.</Empty>
				) : (
					<div className="flex flex-col gap-[10px]">
						{queue.reports.map((r) => (
							<ReportCard key={r.id} report={r} onChange={refresh} />
						))}
					</div>
				)}
			</section>

			<section>
				<h2 className={SECTION_HEADING}>Failed submissions ({queue.failedSubmissions.length})</h2>
				{queue.failedSubmissions.length === 0 ? (
					<Empty>No failed submissions.</Empty>
				) : (
					<div className="flex flex-col gap-[10px]">
						{queue.failedSubmissions.map((s) => (
							<SubmissionCard key={s.id} submission={s} />
						))}
					</div>
				)}
			</section>

			<section>
				<h2 className={SECTION_HEADING}>Flagged skills ({queue.flaggedSkills.length})</h2>
				{queue.flaggedSkills.length === 0 ? (
					<Empty>No flagged skills.</Empty>
				) : (
					<div className="flex flex-col gap-[10px]">
						{queue.flaggedSkills.map((s) => (
							<FlaggedCard key={s.slug} skill={s} onChange={refresh} />
						))}
					</div>
				)}
			</section>

			<CurationSection />
		</div>
	);
}

// Toggle featured / verified on every published skill; its own fetch, since the
// review queue doesn't carry published listings.
function CurationSection() {
	const [skills, setSkills] = useState<PublicSkillSummary[] | null | 'error'>(null);

	const load = useCallback(async () => {
		const res = await getSkills();
		setSkills(res.success ? res.data : 'error');
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const count = Array.isArray(skills) ? skills.length : '-';
	return (
		<section>
			<h2 className={SECTION_HEADING}>Published skills ({count})</h2>
			{skills === null && <Empty>Loading published skills...</Empty>}
			{skills === 'error' && <p className="text-[13px] text-fail">Couldn't load published skills.</p>}
			{Array.isArray(skills) &&
				(skills.length === 0 ? (
					<Empty>No published skills yet.</Empty>
				) : (
					<div className="flex flex-col gap-[10px]">
						{skills.map((s) => (
							<CurationCard key={s.slug} skill={s} onChange={load} />
						))}
					</div>
				))}
		</section>
	);
}

function CurationCard({
	skill,
	onChange,
}: {
	skill: PublicSkillSummary;
	onChange: () => Promise<void>;
}) {
	const { busy, error, run } = useAction(onChange);
	return (
		<div className={CARD}>
			<div className="flex items-center justify-between gap-4">
				<div className="min-w-0">
					<a href={`/skills/${skill.slug}`} className="font-semibold hover:text-accent">
						{skill.name}
					</a>
					<div className="mt-[2px] text-[12px] text-faint">
						{skill.attributedTo ? `curated - ${skill.attributedTo}` : `@${skill.maintainer}`}
					</div>
				</div>
				<div className="flex flex-none gap-[8px]">
					<ToggleButton
						label="Featured"
						on={skill.featured}
						busy={busy}
						onClick={() => void run(() => setFeatured(skill.slug, !skill.featured))}
					/>
					<ToggleButton
						label="Verified"
						on={skill.verified}
						busy={busy}
						onClick={() => void run(() => setVerified(skill.slug, !skill.verified))}
					/>
				</div>
			</div>
			{error && <p className="mt-[8px] text-[12px] text-fail">{error}</p>}
		</div>
	);
}

function ToggleButton({
	label,
	on,
	busy,
	onClick,
}: {
	label: string;
	on: boolean;
	busy: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			disabled={busy}
			onClick={onClick}
			aria-pressed={on}
			className={`${BTN_BASE} border ${
				on
					? 'border-pass-line bg-pass-soft text-pass'
					: 'border-border text-muted hover:text-text'
			}`}
		>
			{on ? `✓ ${label}` : label}
		</button>
	);
}

function Empty({ children }: { children: React.ReactNode }) {
	return <p className="py-[10px] text-[13px] text-muted">{children}</p>;
}

// A single async action button that surfaces its own error and disables while
// running; on success it hands control back to the parent to refetch.
function useAction(onChange: () => Promise<void>) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	async function run(fn: () => Promise<ApiResult<unknown>>) {
		setBusy(true);
		setError(null);
		const res = await fn();
		if (res.success) {
			await onChange();
		} else {
			setError(res.error);
			setBusy(false);
		}
	}
	return { busy, error, run };
}

function ReportCard({ report, onChange }: { report: AdminAbuseReport; onChange: () => Promise<void> }) {
	const { busy, error, run } = useAction(onChange);
	return (
		<div className={CARD}>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<a href={`/skills/${report.skill.slug}`} className="font-semibold hover:text-accent">
						{report.skill.name}
					</a>
					<div className="mt-[2px] text-[12px] text-faint">
						reported by @{report.reporter.username} - {timeAgo(report.createdAt)}
					</div>
				</div>
				<SkillHistoryToggle slug={report.skill.slug} />
			</div>
			<p className="mt-[9px] whitespace-pre-wrap text-[13px] text-muted">{report.reason}</p>
			{error && <p className="mt-[8px] text-[12px] text-fail">{error}</p>}
			<div className="mt-[11px] flex flex-wrap gap-[8px]">
				<button
					type="button"
					disabled={busy}
					onClick={() => void run(() => resolveReport(report.id, 'actioned'))}
					className={`${BTN_BASE} border border-fail-line bg-fail-soft text-fail`}
				>
					Uphold (dock -25)
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={() => void run(() => resolveReport(report.id, 'reviewed'))}
					className={`${BTN_BASE} border border-border text-muted hover:text-text`}
				>
					Dismiss
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={() => void run(() => flagSkill(report.skill.slug))}
					className={`${BTN_BASE} border border-warn-line bg-warn-soft text-warn`}
				>
					Flag skill
				</button>
			</div>
		</div>
	);
}

function SubmissionCard({ submission }: { submission: AdminSubmission }) {
	return (
		<div className={CARD}>
			<div className="flex items-center justify-between gap-4">
				<span className="font-mono text-[12.5px] text-muted">
					#{submission.id} - {submission.sourceType} - @{submission.user.username}
				</span>
				<span className="text-[12px] text-faint">{timeAgo(submission.createdAt)}</span>
			</div>
			{submission.githubUrl && (
				<a
					href={submission.githubUrl}
					className="mt-[4px] block truncate text-[12px] text-accent hover:underline"
				>
					{submission.githubUrl}
				</a>
			)}
			{submission.report && (submission.report.failures.length > 0 || submission.report.warnings.length > 0) && (
				<ul className="mt-[9px] flex flex-col gap-[5px]">
					{submission.report.failures.map((f, i) => (
						<Finding key={`f${i}`} tint="text-fail" finding={f} />
					))}
					{submission.report.warnings.map((w, i) => (
						<Finding key={`w${i}`} tint="text-warn" finding={w} />
					))}
				</ul>
			)}
		</div>
	);
}

function Finding({
	tint,
	finding,
}: {
	tint: string;
	finding: { code: string; message: string; location?: { path: string; line?: number } };
}) {
	return (
		<li className="text-[12.5px] text-muted">
			<span className={`font-mono text-[11px] ${tint}`}>{finding.code}</span> {finding.message}
			{finding.location && (
				<span className="text-faint">
					{' '}
					({finding.location.path}
					{finding.location.line ? `:${finding.location.line}` : ''})
				</span>
			)}
		</li>
	);
}

function FlaggedCard({ skill, onChange }: { skill: AdminSkillRef; onChange: () => Promise<void> }) {
	const { busy, error, run } = useAction(onChange);
	return (
		<div className={CARD}>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<span className="font-semibold">{skill.name}</span>
					<div className="mt-[2px] text-[12px] text-faint">
						maintained by @{skill.maintainer.username} - hidden from the directory
					</div>
				</div>
				<SkillHistoryToggle slug={skill.slug} />
			</div>
			{error && <p className="mt-[8px] text-[12px] text-fail">{error}</p>}
			<div className="mt-[11px]">
				<button
					type="button"
					disabled={busy}
					onClick={() => void run(() => unflagSkill(skill.slug))}
					className={`${BTN_BASE} border border-pass-line bg-pass-soft text-pass`}
				>
					Unflag (restore)
				</button>
			</div>
		</div>
	);
}

function SkillHistoryToggle({ slug }: { slug: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="flex-none">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="cursor-pointer font-mono text-[11px] text-faint hover:text-text"
			>
				{open ? 'hide history' : 'history'}
			</button>
			{open && <SkillHistory slug={slug} />}
		</div>
	);
}

function SkillHistory({ slug }: { slug: string }) {
	const [rows, setRows] = useState<AdminVersionHistory[] | null | 'error'>(null);
	useEffect(() => {
		let cancelled = false;
		void getSkillHistory(slug).then((res) => {
			if (cancelled) return;
			setRows(res.success ? res.data : 'error');
		});
		return () => {
			cancelled = true;
		};
	}, [slug]);

	if (rows === null) return <p className="mt-2 text-[11px] text-faint">Loading...</p>;
	if (rows === 'error') return <p className="mt-2 text-[11px] text-fail">Couldn't load history.</p>;
	if (rows.length === 0) return <p className="mt-2 text-[11px] text-faint">No versions.</p>;
	return (
		<div className="mt-2 w-[240px] rounded-sm border border-border-2 bg-bg-well p-2 text-left">
			{rows.map((v) => (
				<div key={v.version} className="flex items-center justify-between py-[3px] text-[11.5px]">
					<span className="font-mono text-muted">v{v.version}</span>
					<span
						className={
							v.validationStatus === 'passed'
								? 'text-pass'
								: v.validationStatus === 'warning'
									? 'text-warn'
									: 'text-fail'
						}
					>
						{v.validationStatus} - {v.riskLevel}
					</span>
				</div>
			))}
		</div>
	);
}
