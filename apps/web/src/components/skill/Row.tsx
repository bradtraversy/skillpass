import { CATEGORIES, type CategorySlug, type PublicSkillSummary } from 'skill-schema';
import { firstSentence, monogram, timeAgo } from '../../lib/format';

// Static class strings so Tailwind's JIT sees them; tints stay soft enough
// that verdict color still reads as the loudest signal on the page.
const TILE_TINTS: Record<CategorySlug, string> = {
	'security-review': 'border-rose-400/25 bg-rose-400/10 text-rose-300',
	fuzzing: 'border-orange-400/25 bg-orange-400/10 text-orange-300',
	blockchain: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
	cryptography: 'border-teal-400/25 bg-teal-400/10 text-teal-300',
	'code-analysis': 'border-sky-400/25 bg-sky-400/10 text-sky-300',
	testing: 'border-lime-400/25 bg-lime-400/10 text-lime-300',
	'agent-workflow': 'border-violet-400/25 bg-violet-400/10 text-violet-300',
	'dev-practices': 'border-indigo-400/25 bg-indigo-400/10 text-indigo-300',
	'docs-writing': 'border-amber-400/25 bg-amber-400/10 text-amber-300',
	'design-creative': 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300',
	'knowledge-notes': 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
	'dev-tooling': 'border-blue-400/25 bg-blue-400/10 text-blue-300',
};

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
