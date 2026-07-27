import { findingCopy, type ReportFinding } from 'skill-schema';

// Published passports carry warnings only (failed submissions never publish),
// so every finding renders with the warning treatment. Labels and descriptions
// come from the shared FINDING_COPY map keyed by code - stored passports are
// immutable, so their message text is only the fallback for unmapped codes.
export default function Finding({ finding, open = false }: { finding: ReportFinding; open?: boolean }) {
	const copy = findingCopy(finding.code);
	const location = finding.location
		? `${finding.location.path}${finding.location.line != null ? `:${finding.location.line}` : ''}`
		: null;
	const inBundledDocs =
		finding.location != null &&
		(finding.location.path.startsWith('references/') || finding.location.path.startsWith('docs/'));

	return (
		<details open={open} className="group mt-[10px] rounded-md border border-border bg-surface-2">
			<summary className="flex cursor-pointer list-none items-center gap-[11px] px-[14px] py-[12px] text-[13.5px] font-semibold [&::-webkit-details-marker]:hidden">
				<svg
					className="flex-none text-warn"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
					<path d="M12 9v4M12 17h.01" />
				</svg>
				{copy?.label ?? finding.code}
				{inBundledDocs && (
					<span className="font-mono text-[10.5px] font-normal uppercase tracking-[0.08em] text-faint">
						in bundled docs
					</span>
				)}
				<svg
					className="ml-auto flex-none text-faint transition-transform group-open:rotate-90"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
			</summary>
			<div className="pt-[2px] pr-[14px] pb-[14px] pl-[45px] text-[13px] text-muted">
				{copy?.description ?? finding.message}
				{finding.location && (
					<span className="mt-[9px] block rounded-sm border border-border bg-bg-well px-[11px] py-[9px] font-mono text-[12px]">
						<span className="block text-[10.5px] uppercase tracking-[0.08em] text-faint">
							the flagged line, quoted from {location}
						</span>
						{finding.location.snippet && (
							<span className="mt-[6px] block text-text">{finding.location.snippet}</span>
						)}
					</span>
				)}
			</div>
		</details>
	);
}
