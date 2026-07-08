import { useEffect, useState } from 'react';
import type { PublicPreflight, RiskLevel } from 'skill-schema';
import { downloadUrl, getPreflight } from '../../lib/api';
import { VERDICT_TINT } from '../../lib/verdict';
import PermissionRow from './PermissionRow';
import Stamp from './Stamp';

const RISK_DOT: Record<RiskLevel, string> = {
	low: 'bg-risk-low',
	medium: 'bg-risk-med',
	high: 'bg-risk-high',
	critical: 'bg-risk-crit',
};

const SECTION = 'mb-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type LoadState =
	| { phase: 'loading' }
	| { phase: 'error' }
	| { phase: 'ready'; preflight: PublicPreflight };

function DiffLine({ preflight }: { preflight: PublicPreflight }) {
	const { diff } = preflight;
	if (!diff) {
		return (
			<p className="text-[12.5px] text-muted">First published version - nothing to compare.</p>
		);
	}
	const added = [...new Set([...diff.declared.added, ...diff.detected.added])];
	const removed = [...new Set([...diff.declared.removed, ...diff.detected.removed])];
	if (added.length === 0 && removed.length === 0) {
		return (
			<p className="text-[12.5px] text-muted">
				No permission changes since v{diff.previousVersion}.
			</p>
		);
	}
	return (
		<div className="space-y-[3px] text-[12.5px]">
			{added.map((key) => (
				<p key={key} className="font-mono text-fail">
					+ {key} <span className="font-sans text-muted">(new since v{diff.previousVersion})</span>
				</p>
			))}
			{removed.map((key) => (
				<p key={key} className="font-mono text-pass">
					- {key} <span className="font-sans text-muted">(no longer requested)</span>
				</p>
			))}
		</div>
	);
}

export default function PreflightPanel({
	slug,
	version,
	onClose,
}: {
	slug: string;
	version: string;
	onClose: () => void;
}) {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });

	useEffect(() => {
		let cancelled = false;
		void getPreflight(slug, version).then((res) => {
			if (cancelled) return;
			setLoad(res.success ? { phase: 'ready', preflight: res.data } : { phase: 'error' });
		});
		return () => {
			cancelled = true;
		};
	}, [slug, version]);

	return (
		<div className="mt-[10px] rounded-md border border-border bg-surface">
			<div className="flex items-center justify-between border-b border-dashed border-border-2 px-[16px] py-[11px]">
				<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
					Pre-flight check · v{version}
				</span>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close pre-flight"
					className="cursor-pointer text-faint hover:text-text"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						aria-hidden="true"
					>
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			{load.phase === 'loading' && (
				<p className="px-[16px] py-[18px] text-[12.5px] text-muted">Running pre-flight...</p>
			)}
			{load.phase === 'error' && (
				<p className="px-[16px] py-[18px] text-[12.5px] text-fail">
					Pre-flight unavailable - can't reach the API. Don't install without it.
				</p>
			)}

			{load.phase === 'ready' && (
				<div className="space-y-[18px] px-[16px] py-[15px]">
					<div className="flex flex-wrap items-center gap-[11px]">
						<Stamp verdict={load.preflight.validationStatus} />
						<span className="flex items-center gap-[6px] text-[13px] font-semibold">
							<span className={`size-[8px] rounded-full ${RISK_DOT[load.preflight.riskLevel]}`} />
							{cap(load.preflight.riskLevel)} risk
						</span>
						<span
							className={`ml-auto flex items-center gap-[5px] font-mono text-[11.5px] ${load.preflight.sourceVerified ? 'text-pass' : 'text-fail'}`}
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
								{load.preflight.sourceVerified ? (
									<path d="M20 6 9 17l-5-5" />
								) : (
									<path d="M18 6 6 18M6 6l12 12" />
								)}
							</svg>
							{load.preflight.sourceVerified ? 'source verified' : 'hash mismatch'}
						</span>
					</div>

					<div className="truncate font-mono text-[11.5px] text-faint">
						{load.preflight.sourceHash}
					</div>

					<div>
						<div className={SECTION}>Permissions this skill uses</div>
						<div className="divide-y divide-border">
							{load.preflight.permissions.detected.length === 0 && (
								<p className="py-[8px] text-[12.5px] text-muted">No permissions detected.</p>
							)}
							{load.preflight.permissions.detected.map((key) => (
								<PermissionRow key={key} permKey={key} />
							))}
						</div>
					</div>

					<div>
						<div className={SECTION}>Changes since previous version</div>
						<DiffLine preflight={load.preflight} />
					</div>

					{load.preflight.blocked ? (
						<p
							className={`rounded-sm border px-[12px] py-[9px] text-[12.5px] ${VERDICT_TINT.failed.all}`}
						>
							{load.preflight.blockedReason ?? 'This version is blocked.'}
						</p>
					) : (
						<a
							href={downloadUrl(slug, version)}
							download
							className="inline-flex items-center gap-[7px] rounded-sm bg-accent px-[15px] py-[9px] text-[13px] font-semibold text-accent-ink hover:bg-accent-hover"
						>
							<svg
								width="15"
								height="15"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<path d="M7 10l5 5 5-5M12 15V3" />
							</svg>
							Download {slug}-{version}.zip
						</a>
					)}
				</div>
			)}
		</div>
	);
}
