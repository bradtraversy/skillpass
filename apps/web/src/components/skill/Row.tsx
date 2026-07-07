import type { PublicSkillSummary, RiskLevel } from 'skill-schema';
import { monogram, timeAgo } from '../../lib/format';
import Stamp from './Stamp';

const RISK_LABEL: Record<RiskLevel, string> = {
	low: 'low risk',
	medium: 'medium',
	high: 'high',
	critical: 'critical',
};

const RISK_DOT: Record<RiskLevel, string> = {
	low: 'bg-risk-low',
	medium: 'bg-risk-med',
	high: 'bg-risk-high',
	critical: 'bg-risk-crit',
};

export default function Row({ skill, rank }: { skill: PublicSkillSummary; rank: number }) {
	const failed = skill.validationStatus === 'failed';
	return (
		<a
			href={`/skills/${skill.slug}`}
			className="grid cursor-pointer grid-cols-[30px_34px_1fr_auto_auto] items-center gap-4 rounded-md border-b border-border px-3 py-[15px] hover:bg-surface"
		>
			<span className="text-right font-mono text-[13px] text-faint">
				{String(rank).padStart(2, '0')}
			</span>

			<span
				className={`grid size-[34px] place-items-center rounded-[9px] border bg-surface-2 font-mono text-[13px] font-semibold ${
					failed ? 'border-fail-line text-fail' : 'border-border-2 text-muted'
				}`}
			>
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

			<div className="flex items-center gap-3">
				<Stamp verdict={skill.validationStatus} />
				<span className="inline-flex w-[82px] items-center gap-[6px] text-[11.5px] text-muted">
					<span className={`size-[7px] rounded-full ${RISK_DOT[skill.riskLevel]}`} />
					{RISK_LABEL[skill.riskLevel]}
				</span>
			</div>

			<div className="w-24 text-right font-mono text-[11.5px] text-faint">
				<b className="block text-[13px] font-semibold text-muted">v{skill.version}</b>
				{timeAgo(skill.publishedAt)}
			</div>
		</a>
	);
}
