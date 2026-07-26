import type { PublicSkillSummary } from 'skill-schema';
import { monogram, timeAgo } from '../../lib/format';

export default function Row({ skill, rank }: { skill: PublicSkillSummary; rank: number }) {
	const noteCount = skill.noteCount ?? 0;
	return (
		<a
			href={`/skills/${skill.slug}`}
			className="grid cursor-pointer grid-cols-[30px_34px_1fr_auto_auto] items-center gap-4 rounded-md border-b border-border px-3 py-[15px] hover:bg-surface"
		>
			<span className="text-right font-mono text-[13px] text-faint">
				{String(rank).padStart(2, '0')}
			</span>

			<span className="grid size-[34px] place-items-center rounded-[9px] border border-border-2 bg-surface-2 font-mono text-[13px] font-semibold text-muted">
				{monogram(skill.name)}
			</span>

			<div className="min-w-0">
				<div className="flex items-center gap-[10px]">
					<b className="font-semibold tracking-[-0.01em]">{skill.name}</b>
					<span className="flex gap-[5px]">
						{skill.targets.map((target) => (
							<span
								key={target}
								className="rounded-[4px] border border-border px-[6px] py-px font-mono text-[10.5px] text-muted"
							>
								{target}
							</span>
						))}
					</span>
				</div>
				<div className="mt-[3px] max-w-[46ch] truncate text-[12.5px] text-muted">
					{skill.summary}
				</div>
			</div>

			<div className="flex items-center justify-end gap-[14px] text-[11.5px] text-muted">
				<span className="inline-flex items-center gap-[5px]">
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
					validated
				</span>
				{noteCount > 0 && (
					<span className="inline-flex items-center gap-[5px] text-faint">
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="flex-none"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="10" />
							<path d="M12 16v-4M12 8h.01" />
						</svg>
						{noteCount} to note
					</span>
				)}
			</div>

			<div className="w-24 text-right font-mono text-[11.5px] text-faint">
				<b className="block text-[13px] font-semibold text-muted">v{skill.version}</b>
				{timeAgo(skill.publishedAt)}
			</div>
		</a>
	);
}
