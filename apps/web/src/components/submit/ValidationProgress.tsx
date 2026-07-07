import { useEffect, useState } from 'react';
import type { ProgressStep, ProgressStepState, PublicValidation } from 'skill-schema';
import { getValidation } from '../../lib/api';

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
			timer = setTimeout(poll, POLL_MS);
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
						<span className={row.state === 'pending' ? 'text-faint' : 'text-muted'}>
							{row.label}
						</span>
					</li>
				))}
			</ul>
			<Outcome validation={validation} stopped={stopped} />
		</div>
	);
}

function Outcome({ validation, stopped }: PanelState) {
	if (stopped === 'unreachable') {
		return <p className="mt-3 text-[13px] text-fail">Can't reach the API - is it running?</p>;
	}
	if (stopped === 'exhausted') {
		return (
			<p className="mt-3 text-[13px] text-muted">
				Still running - check back later for the result.
			</p>
		);
	}
	if (stopped !== 'terminal' || !validation) {
		return null;
	}
	if (validation.job?.state === 'error') {
		return (
			<p className="mt-3 text-[13px] text-fail">
				Validation hit a problem: {validation.job.error ?? 'unknown error'}. Your draft is safe -
				try again later.
			</p>
		);
	}
	const status = validation.submissionStatus;
	const tone = status === 'passed' ? 'text-pass' : status === 'warning' ? 'text-warn' : 'text-fail';
	return (
		<p className={`mt-3 text-[13px] font-semibold ${tone}`}>
			Validation {status}
			{validation.report ? ` - ${validation.report.riskLevel} risk` : ''}
		</p>
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
					<path
						d="M7 2.2 12.6 11.8H1.4Z"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.4"
						strokeLinejoin="round"
					/>
					<path d="M7 6v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
					<circle cx="7" cy="10.4" r="0.7" fill="currentColor" />
				</svg>
			);
		case 'fail':
			return (
				<svg viewBox="0 0 14 14" className={`${base} text-fail`} aria-hidden="true">
					<path
						d="m4 4 6 6M10 4l-6 6"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
					/>
				</svg>
			);
	}
}
