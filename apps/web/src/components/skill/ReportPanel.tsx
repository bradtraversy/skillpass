import { useEffect, useState } from 'react';
import { ABUSE_REASON_MAX, ABUSE_REASON_MIN } from 'skill-schema';
import { getMe, reportSkill, signInUrl } from '../../lib/api';
import { CloseIcon } from '../ui/icons';

type PanelState =
	| { phase: 'checking' }
	| { phase: 'signedout' }
	| { phase: 'form'; error?: string; submitting: boolean }
	| { phase: 'done' };

export default function ReportPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
	const [state, setState] = useState<PanelState>({ phase: 'checking' });
	const [reason, setReason] = useState('');

	useEffect(() => {
		let cancelled = false;
		void getMe().then((res) => {
			if (cancelled) return;
			setState(res.success ? { phase: 'form', submitting: false } : { phase: 'signedout' });
		});
		return () => {
			cancelled = true;
		};
	}, []);

	async function submit() {
		setState({ phase: 'form', submitting: true });
		const res = await reportSkill(slug, reason);
		if (res.success) {
			setState({ phase: 'done' });
		} else {
			setState({ phase: 'form', submitting: false, error: res.error });
		}
	}

	return (
		<div className="mt-[12px] rounded-md border border-border bg-surface">
			<div className="flex items-center justify-between border-b border-dashed border-border-2 px-[16px] py-[10px]">
				<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
					Report this skill
				</span>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close report form"
					className="cursor-pointer text-faint hover:text-text"
				>
					<CloseIcon size={14} />
				</button>
			</div>

			<div className="px-[16px] py-[14px]">
				{state.phase === 'checking' && (
					<p className="text-[12.5px] text-muted">Checking your session...</p>
				)}

				{state.phase === 'signedout' && (
					<p className="text-[12.5px] text-muted">
						<a href={signInUrl()} className="text-accent hover:underline">
							Sign in with GitHub
						</a>{' '}
						to report a skill. Reports go to the admin review queue.
					</p>
				)}

				{state.phase === 'form' && (
					<>
						<textarea
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							rows={4}
							maxLength={ABUSE_REASON_MAX}
							placeholder={`What's wrong with this skill? Be specific (${ABUSE_REASON_MIN}-${ABUSE_REASON_MAX} characters) - what it does, where you saw it.`}
							className="w-full rounded-sm border border-border-2 bg-bg-well px-3 py-[9px] text-[13px] placeholder:text-faint focus:border-accent focus:outline-none"
						/>
						{state.error && <p className="mt-[7px] text-[12.5px] text-fail">{state.error}</p>}
						<div className="mt-[10px] flex items-center gap-[12px]">
							<button
								type="button"
								onClick={() => void submit()}
								disabled={state.submitting || reason.trim().length < ABUSE_REASON_MIN}
								className="cursor-pointer rounded-sm bg-accent px-[15px] py-[8px] text-[13px] font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
							>
								{state.submitting ? 'Submitting...' : 'Submit report'}
							</button>
							<span className="text-[11.5px] text-faint">
								{reason.trim().length}/{ABUSE_REASON_MAX}
							</span>
						</div>
					</>
				)}

				{state.phase === 'done' && (
					<p className="text-[12.5px] text-pass">
						Report received - an admin will review it. Thanks for keeping the directory safe.
					</p>
				)}
			</div>
		</div>
	);
}
