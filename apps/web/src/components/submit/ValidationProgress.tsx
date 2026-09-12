import { useEffect, useState } from 'react';
import type { ProgressStep, ProgressStepState, PublicValidation, ReportFinding } from 'skill-schema';
import { getValidation, publishSubmission } from '../../lib/api';

const POLL_MS = 2000;
const MAX_POLLS = 60;
const MAX_CONSECUTIVE_FAILURES = 5;

interface PanelState {
	validation: PublicValidation | null;
	stopped: 'terminal' | 'exhausted' | 'unreachable' | null;
}

export default function ValidationProgress({ submissionId }: { submissionId: number }) {
	const [{ validation, stopped }, setState] = useState<PanelState>({
		validation: null,
		stopped: null,
	});

	useEffect(() => {
		let cancelled = false;
		let polls = 0;
		let failures = 0;
		let timer: ReturnType<typeof setTimeout>;

		// setTimeout chaining, not setInterval: a slow response can't stack requests.
		async function poll() {
			polls += 1;
			const res = await getValidation(submissionId);
			if (cancelled) return;
			if (res.success) {
				failures = 0;
				const jobState = res.data.job?.state;
				if (jobState === 'done' || jobState === 'error') {
					setState({ validation: res.data, stopped: 'terminal' });
					return;
				}
				setState({ validation: res.data, stopped: null });
			} else {
				failures += 1;
				if (failures >= MAX_CONSECUTIVE_FAILURES) {
					setState((s) => ({ ...s, stopped: 'unreachable' }));
					return;
				}
			}
			if (polls >= MAX_POLLS) {
				setState((s) => ({ ...s, stopped: 'exhausted' }));
				return;
			}
			timer = setTimeout(() => void poll(), POLL_MS);
		}

		void poll();
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [submissionId]);

	const rows: ProgressStep[] = validation?.job?.progress?.length
		? validation.job.progress
		: [{ key: 'queued', label: 'Queued for validation', state: 'running' }];

	return (
		<div className="mt-4 border-t border-border pt-4">
			<ul className="flex flex-col gap-[7px]">
				{rows.map((row) => (
					<li key={row.key} className="flex items-center gap-2.5 text-[13px]">
						<StepIcon state={row.state} />
						<span className={row.state === 'pending' ? 'text-faint' : 'text-muted'}>{row.label}</span>
					</li>
				))}
			</ul>
			<Outcome validation={validation} stopped={stopped} submissionId={submissionId} />
		</div>
	);
}

function Outcome({ validation, stopped, submissionId }: PanelState & { submissionId: number }) {
	if (stopped === 'unreachable') {
		return <p className="mt-3 text-[13px] text-fail">Can't reach the API - is it running?</p>;
	}
	if (stopped === 'exhausted') {
		return <p className="mt-3 text-[13px] text-muted">Still running - check back later for the result.</p>;
	}
	if (stopped !== 'terminal' || !validation) {
		return null;
	}
	if (validation.job?.state === 'error') {
		return (
			<p className="mt-3 text-[13px] text-fail">
				Validation hit a problem: {validation.job.error ?? 'unknown error'}. Your draft is safe - try again later.
			</p>
		);
	}
	const status = validation.submissionStatus;
	const tone = status === 'passed' ? 'text-pass' : status === 'warning' ? 'text-warn' : 'text-fail';
	return (
		<>
			<p className={`mt-3 text-[13px] font-semibold ${tone}`}>
				Validation {status}
				{validation.report ? ` - ${validation.report.riskLevel} risk` : ''}
			</p>
			{status === 'passed' && <PublishButton submissionId={submissionId} />}
			{validation.report && <Findings report={validation.report} />}
		</>
	);
}

type PublishState =
	| { phase: 'idle'; error: string | null }
	| { phase: 'publishing' }
	| { phase: 'published'; slug: string; version: string };

function PublishButton({ submissionId }: { submissionId: number }) {
	const [state, setState] = useState<PublishState>({ phase: 'idle', error: null });

	async function onPublish() {
		setState({ phase: 'publishing' });
		const res = await publishSubmission(submissionId);
		if (res.success) {
			setState({ phase: 'published', slug: res.data.slug, version: res.data.version });
		} else {
			setState({ phase: 'idle', error: res.error });
		}
	}

	if (state.phase === 'published') {
		return (
			<p className="mt-3 text-[13px] font-semibold text-pass">
				Published as {state.slug} v{state.version}
			</p>
		);
	}
	return (
		<div className="mt-3">
			<button
				type="button"
				onClick={onPublish}
				disabled={state.phase === 'publishing'}
				className="rounded-sm bg-accent px-4 py-[9px] text-[13.5px] font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
			>
				{state.phase === 'publishing' ? 'Publishing...' : 'Publish skill'}
			</button>
			{state.phase === 'idle' && state.error && <p className="mt-2 text-[13px] text-fail">{state.error}</p>}
		</div>
	);
}

type TonedFinding = ReportFinding & { tone: 'fail' | 'warn' };

function Findings({ report }: { report: NonNullable<PublicValidation['report']> }) {
	const findings: TonedFinding[] = [
		...report.failures.map((f) => ({ ...f, tone: 'fail' as const })),
		...report.warnings.map((f) => ({ ...f, tone: 'warn' as const })),
	];
	const [open, setOpen] = useState(findings.length <= 3);

	if (findings.length === 0) {
		return null;
	}
	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="mt-2 cursor-pointer text-[12px] text-muted underline underline-offset-2 hover:text-text"
			>
				Show {findings.length} findings
			</button>
		);
	}
	return (
		<ul className="mt-2 flex flex-col gap-2">
			{findings.map((f, i) => (
				<li
					key={i}
					className={`rounded-sm border px-3 py-2 text-[12.5px] ${
						f.tone === 'fail' ? 'border-fail-line bg-fail-soft' : 'border-warn-line bg-warn-soft'
					}`}
				>
					<p className={f.tone === 'fail' ? 'text-fail' : 'text-warn'}>{f.message}</p>
					{f.location && (
						<p className="mt-1 font-mono text-[11.5px] text-muted">
							{f.location.path}
							{f.location.line != null ? `:${f.location.line}` : ''}
						</p>
					)}
					{f.location?.snippet && (
						<pre className="mt-1 overflow-x-auto rounded-[4px] bg-bg-well px-2 py-1 font-mono text-[11.5px] text-muted">
							{f.location.snippet}
						</pre>
					)}
				</li>
			))}
		</ul>
	);
}

function StepIcon({ state }: { state: ProgressStepState }) {
	const base = 'size-3.5 shrink-0';
	switch (state) {
		case 'pending':
			return (
				<svg viewBox="0 0 14 14" className={`${base} text-faint`} aria-hidden="true">
					<circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
				</svg>
			);
		case 'running':
			return (
				<svg viewBox="0 0 14 14" className={`${base} animate-spin text-accent`} aria-hidden="true">
					<circle
						cx="7"
						cy="7"
						r="5"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeDasharray="18 14"
						strokeLinecap="round"
					/>
				</svg>
			);
		case 'ok':
			return (
				<svg viewBox="0 0 14 14" className={`${base} text-pass`} aria-hidden="true">
					<path
						d="m3.5 7.5 2.4 2.4L10.5 4.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			);
		case 'warn':
			return (
				<svg viewBox="0 0 14 14" className={`${base} text-warn`} aria-hidden="true">
					<path d="M7 2.2 12.6 11.8H1.4Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
					<path d="M7 6v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
					<circle cx="7" cy="10.4" r="0.7" fill="currentColor" />
				</svg>
			);
		case 'fail':
			return (
				<svg viewBox="0 0 14 14" className={`${base} text-fail`} aria-hidden="true">
					<path d="m4 4 6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
				</svg>
			);
	}
}
