import type { AiReview as AiReviewData } from 'skill-schema';

const VERDICT: Record<AiReviewData['verdict'], { label: string; dot: string }> = {
	clear: { label: 'Clear', dot: 'bg-risk-low' },
	caution: { label: 'Caution', dot: 'bg-risk-med' },
	concern: { label: 'Concern', dot: 'bg-risk-high' },
};

export default function AiReview({ review }: { review: AiReviewData | null }) {
	if (!review) return null;
	const verdict = VERDICT[review.verdict];

	return (
		<section className="mt-[26px] overflow-hidden rounded-lg border border-border bg-surface">
			<div className="flex items-center justify-between border-b border-dashed border-border-2 px-[18px] py-[13px] font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted">
				<span className="flex items-center gap-[9px]">
					<svg
						className="flex-none text-accent"
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
						<path d="M9.94 14.06 6 22l3.94-1.94L12 24l2.06-3.94L18 22l-3.94-7.94" />
						<path d="M12 2 9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5z" />
					</svg>
					AI Review
				</span>
				<span className="flex items-center gap-[7px] text-[12px] font-semibold text-text">
					<span className={`size-[8px] rounded-full ${verdict.dot}`} />
					{verdict.label}
				</span>
			</div>

			<div className="p-[18px]">
				<div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
					What this skill does
				</div>
				<p className="text-[14px] leading-[1.6] text-text">{review.summary}</p>
				<p className="mt-[12px] text-[13px] leading-[1.6] text-muted">{review.reasoning}</p>
				<p className="mt-[15px] border-t border-dashed border-border-2 pt-[11px] text-[11.5px] leading-[1.5] text-faint">
					AI-generated from the skill's source, not a guarantee. It's a starting point - read the
					source yourself before installing.
				</p>
			</div>
		</section>
	);
}
