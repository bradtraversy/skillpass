import { useCallback, useEffect, useState } from 'react';
import type {
	AbuseReportStatus,
	MaintainerReport,
	MaintainerSkill,
	PublicSubmission,
	SkillStatus,
	SubmissionStatus,
} from 'skill-schema';
import {
	getMyReports,
	getMySkills,
	getMySubmissions,
	publishSubmission,
	relistSkill,
	signInUrl,
	unlistSkill,
} from '../../lib/api';
import { BTN_BASE, CARD, SECTION_HEADING } from '../../lib/classes';
import { repoHandle, timeAgo } from '../../lib/format';
import { STATUS_TINT } from '../../lib/status-tint';
import { useAction } from '../../lib/use-action';
import Stamp from '../skill/Stamp';
import Empty from '../ui/Empty';

type LoadState =
	| { phase: 'loading' }
	| { phase: 'signedout' }
	| { phase: 'error' }
	| {
			phase: 'ready';
			skills: MaintainerSkill[];
			submissions: PublicSubmission[];
			reports: MaintainerReport[];
	  };

export default function Dashboard() {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });

	const refresh = useCallback(async () => {
		const [skills, submissions, reports] = await Promise.all([getMySkills(), getMySubmissions(), getMyReports()]);
		if (skills.success && submissions.success && reports.success) {
			setLoad({
				phase: 'ready',
				skills: skills.data,
				submissions: submissions.data,
				reports: reports.data,
			});
		} else if ([skills, submissions, reports].some((r) => !r.success && r.status === 401)) {
			setLoad({ phase: 'signedout' });
		} else {
			setLoad({ phase: 'error' });
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	if (load.phase === 'loading') {
		return <p className="py-16 text-center text-[13px] text-muted">Loading your dashboard...</p>;
	}
	if (load.phase === 'signedout') {
		return (
			<p className="py-16 text-center text-[13px] text-muted">
				<a href={signInUrl()} className="text-accent hover:underline">
					Sign in with GitHub
				</a>{' '}
				to manage your skills.
			</p>
		);
	}
	if (load.phase === 'error') {
		return <p className="py-16 text-center text-[13px] text-fail">Can't reach the API - is it running?</p>;
	}

	const { skills, submissions, reports } = load;
	return (
		<div className="flex flex-col gap-[38px] pb-24">
			<section>
				<h2 className={SECTION_HEADING}>Your skills ({skills.length})</h2>
				{skills.length === 0 ? (
					<Empty>
						No listings yet.{' '}
						<a href="/submit" className="text-accent hover:underline">
							Submit a skill
						</a>{' '}
						to get started.
					</Empty>
				) : (
					<div className="flex flex-col gap-[10px]">
						{skills.map((s) => (
							<SkillCard key={s.slug} skill={s} onChange={refresh} />
						))}
					</div>
				)}
			</section>

			<section>
				<h2 className={SECTION_HEADING}>Your submissions ({submissions.length})</h2>
				{submissions.length === 0 ? (
					<Empty>No submissions yet.</Empty>
				) : (
					<div className="flex flex-col gap-[10px]">
						{submissions.map((s) => (
							<SubmissionCard key={s.id} submission={s} onChange={refresh} />
						))}
					</div>
				)}
			</section>

			<section>
				<h2 className={SECTION_HEADING}>Reports against your skills ({reports.length})</h2>
				{reports.length === 0 ? (
					<Empty>No reports. Keep it that way.</Empty>
				) : (
					<div className="flex flex-col gap-[10px]">
						{reports.map((r) => (
							<ReportCard key={r.id} report={r} />
						))}
					</div>
				)}
			</section>
		</div>
	);
}

function SubmissionCard({ submission, onChange }: { submission: PublicSubmission; onChange: () => Promise<void> }) {
	const { busy, error, run } = useAction(onChange);
	const source =
		submission.sourceType === 'github_url' && submission.githubUrl ? repoHandle(submission.githubUrl) : 'zip upload';
	return (
		<div className={CARD}>
			<div className="flex items-center gap-[10px]">
				<div className="min-w-0 flex-1">
					<p className="text-[14px] font-semibold">{source}</p>
					<p className="mt-[3px] text-[12px] text-muted">
						#{submission.id} · submitted {timeAgo(submission.createdAt)}
					</p>
				</div>
				{submission.status === 'passed' && (
					<button
						type="button"
						disabled={busy}
						onClick={() => run(() => publishSubmission(submission.id))}
						className={`${BTN_BASE} border border-pass-line bg-pass-soft text-pass`}
					>
						{busy ? 'Publishing...' : 'Publish'}
					</button>
				)}
				<StatusChip status={submission.status} />
			</div>
			{error && <p className="mt-[8px] text-[12px] text-fail">{error}</p>}
		</div>
	);
}

function ReportCard({ report }: { report: MaintainerReport }) {
	return (
		<div className={CARD}>
			<div className="flex items-center gap-[10px]">
				<div className="min-w-0 flex-1">
					<a href={`/skills/${report.skill.slug}`} className="text-[14px] font-semibold hover:text-accent">
						{report.skill.name}
					</a>
					<p className="mt-[3px] text-[12px] text-muted">
						"{report.reason}" · {timeAgo(report.createdAt)}
					</p>
				</div>
				<StatusChip status={report.status} />
			</div>
		</div>
	);
}

function StatusChip({ status }: { status: SkillStatus | SubmissionStatus | AbuseReportStatus }) {
	return (
		<span
			className={`rounded-[5px] border px-[9px] py-1 font-mono text-[11px] font-bold tracking-[0.1em] ${STATUS_TINT[status]}`}
		>
			{status.toUpperCase()}
		</span>
	);
}

function SkillCard({ skill, onChange }: { skill: MaintainerSkill; onChange: () => Promise<void> }) {
	return (
		<div className={CARD}>
			<div className="flex items-center gap-[10px]">
				<div className="min-w-0 flex-1">
					<a href={`/skills/${skill.slug}`} className="text-[14px] font-semibold hover:text-accent">
						{skill.name}
					</a>
					<p className="mt-[3px] text-[12px] text-muted">
						{skill.slug}
						{skill.version ? ` · v${skill.version}` : ''} · updated {timeAgo(skill.updatedAt)}
					</p>
				</div>
				{skill.validationStatus && <Stamp verdict={skill.validationStatus} />}
				<StatusChip status={skill.status} />
			</div>
			<SkillActions skill={skill} onChange={onChange} />
		</div>
	);
}

function SkillActions({ skill, onChange }: { skill: MaintainerSkill; onChange: () => Promise<void> }) {
	const { busy, error, run } = useAction(onChange);
	const [arming, setArming] = useState(false);

	if (skill.status === 'flagged') {
		return (
			<p className="mt-[9px] text-[12px] text-muted">
				Flagged by an admin - actions are disabled while it is under review.
			</p>
		);
	}
	if (skill.status !== 'published' && skill.status !== 'private') return null;

	return (
		<div className="mt-[10px] flex flex-wrap items-center gap-[8px]">
			{skill.status === 'published' && !arming && (
				<button
					type="button"
					onClick={() => setArming(true)}
					className={`${BTN_BASE} border border-border-2 text-muted hover:text-text`}
				>
					Unlist
				</button>
			)}
			{skill.status === 'published' && arming && (
				<>
					<span className="text-[12px] text-muted">
						Withdraws the public listing - versions and passports are kept, and you can relist anytime.
					</span>
					<button
						type="button"
						disabled={busy}
						onClick={() => run(() => unlistSkill(skill.slug))}
						className={`${BTN_BASE} border border-fail-line bg-fail-soft text-fail`}
					>
						{busy ? 'Unlisting...' : 'Confirm unlist'}
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={() => setArming(false)}
						className={`${BTN_BASE} border border-border-2 text-muted hover:text-text`}
					>
						Cancel
					</button>
				</>
			)}
			{skill.status === 'private' && (
				<button
					type="button"
					disabled={busy}
					onClick={() => run(() => relistSkill(skill.slug))}
					className={`${BTN_BASE} border border-pass-line bg-pass-soft text-pass`}
				>
					{busy ? 'Relisting...' : 'Relist'}
				</button>
			)}
			{error && <span className="text-[12px] text-fail">{error}</span>}
		</div>
	);
}
