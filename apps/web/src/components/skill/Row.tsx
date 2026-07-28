import { CATEGORIES, type PublicSkillSummary } from 'skill-schema';
import { TILE_TINTS } from '../../lib/categoryTints';
import { firstSentence, monogram, timeAgo } from '../../lib/format';

export default function Row({ skill, rank }: { skill: PublicSkillSummary; rank: number }) {
	const categoryLabel = CATEGORIES.find((c) => c.slug === skill.category)?.label;
	const title = skill.displayName ?? skill.name;
	const tint = skill.category ? TILE_TINTS[skill.category] : undefined;
	return (
		<a
			href={`/skills/${skill.slug}`}
			className="grid cursor-pointer grid-cols-[30px_34px_1fr_auto] items-center gap-4 rounded-md border-b border-border px-3 py-[15px] hover:bg-surface"
		>
			<span className="text-right font-mono text-[13px] text-faint">
				{String(rank).padStart(2, '0')}
			</span>

			<span
				className={`grid size-[34px] place-items-center rounded-[9px] border font-mono text-[13px] font-semibold ${
					tint ?? 'border-border-2 bg-surface-2 text-muted'
				}`}
			>
				{monogram(title)}
			</span>

			<div className="min-w-0">
				<b className="block truncate font-semibold tracking-[-0.01em]">{title}</b>
				<div className="mt-[3px] line-clamp-2 text-[12.5px] text-muted">
					{skill.tagline ?? firstSentence(skill.summary)}
				</div>
			</div>

			<div className="text-right text-[11.5px]">
				<div className="inline-flex items-center gap-[6px] font-mono">
					<svg
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="flex-none text-accent"
						aria-hidden="true"
					>
						<path d="M20 6 9 17l-5-5" />
					</svg>
					<span className="text-faint">{timeAgo(skill.publishedAt)}</span>
				</div>
				{categoryLabel && (
					<div className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
						{categoryLabel}
					</div>
				)}
				<div className="mt-[2px] text-faint">by {skill.attributedTo ?? skill.maintainer}</div>
			</div>
		</a>
	);
}
