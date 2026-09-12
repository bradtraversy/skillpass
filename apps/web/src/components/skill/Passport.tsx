import type { PermissionKey, PublicSkillDetail, ValidationStatus } from 'skill-schema';
import { capitalize } from '../../lib/format';
import { RISK_DOT } from '../../lib/risk';
import { VERDICT_TINT } from '../../lib/verdict';
import Finding from './Finding';
import PermissionRow from './PermissionRow';
import { ShieldIcon } from '../ui/icons';

const VERDICT_LABEL: Record<ValidationStatus, string> = {
	passed: 'Passed',
	warning: 'Warning',
	failed: 'Failed',
};

const VERDICT_ICON: Record<ValidationStatus, React.ReactNode> = {
	passed: (
		<>
			<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
			<path d="m9 11 3 3L22 4" />
		</>
	),
	warning: (
		<>
			<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
			<path d="M12 9v4M12 17h.01" />
		</>
	),
	failed: (
		<>
			<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86" />
			<line x1="12" x2="12" y1="8" y2="12" />
			<line x1="12" x2="12.01" y1="16" y2="16" />
		</>
	),
};

export default function Passport({ detail }: { detail: PublicSkillDetail }) {
	const { passport } = detail;
	const verdict = passport.validationStatus;
	const tint = VERDICT_TINT[verdict];

	const permissions: PermissionKey[] = Array.from(
		new Set([...passport.permissionsSummary.declared, ...passport.permissionsSummary.detected]),
	).sort();

	const monoFields = [
		{ k: 'Targets', v: detail.targets.join(' · ') },
		{ k: 'Source hash', v: passport.sourceHash },
		{ k: 'Commit', v: passport.resolvedCommitSha ?? '- (zip upload)' },
		{ k: 'Validated', v: passport.generatedAt.slice(0, 10) },
	];

	return (
		<div className={`mt-[26px] overflow-hidden rounded-lg border bg-surface ${tint.border}`}>
			<div
				className={`flex items-center justify-between border-b border-dashed border-border-2 px-[18px] py-[13px] font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted ${tint.bg}`}
			>
				<span className="flex items-center gap-[9px]">
					<ShieldIcon className={`flex-none ${tint.text}`} />
					Skill Passport
				</span>
				<span>v{detail.version} · immutable</span>
			</div>

			<div className="grid grid-cols-3 gap-px border-b border-border bg-border max-[620px]:grid-cols-1">
				<div className="bg-surface px-[18px] py-[15px]">
					<div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">Verdict</div>
					<div className={`mt-[5px] flex items-center gap-[7px] text-[14px] font-semibold ${tint.text}`}>
						<svg
							width="15"
							height="15"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							{VERDICT_ICON[verdict]}
						</svg>
						{VERDICT_LABEL[verdict]}
					</div>
				</div>

				<div className="bg-surface px-[18px] py-[15px]">
					<div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">Risk level</div>
					<div className="mt-[5px] flex items-center gap-[7px] text-[14px] font-semibold">
						<span className={`size-[8px] rounded-full ${RISK_DOT[passport.riskLevel]}`} />
						{capitalize(passport.riskLevel)}
					</div>
				</div>

				{monoFields.map((field) => (
					<div key={field.k} className="bg-surface px-[18px] py-[15px]">
						<div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">{field.k}</div>
						<div className="mt-[5px] truncate font-mono text-[13px] font-medium text-muted">{field.v}</div>
					</div>
				))}
			</div>

			<div className="p-[18px]">
				<div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">Permissions requested</div>
				{passport.manifestInferred && (
					<p className="mb-3 rounded-sm border border-border-2 bg-bg-well px-3 py-[9px] text-[12px] text-muted">
						This skill ships no <span className="font-mono">skill.json</span>, so its permissions were inferred from the
						skill's content, not declared by the author.
					</p>
				)}
				<div className="divide-y divide-border">
					{permissions.length === 0 && (
						<p className="py-[11px] text-[12.5px] text-muted">No permissions declared or detected.</p>
					)}
					{permissions.map((key) => (
						<PermissionRow key={key} permKey={key} />
					))}
				</div>

				{passport.warningsSummary.length > 0 && (
					<>
						<div className="mt-[22px] mb-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
							Things to pay attention to ({passport.warningsSummary.length})
						</div>
						<p className="mb-3 text-[12.5px] leading-[1.5] text-muted">
							Our scanner flagged these lines for your review. Patterns like these are common in legitimate security,
							DevOps, and automation skills, so a flag here isn't proof of a problem, but it's worth reading before you
							install.
						</p>
						{passport.warningsSummary.map((finding, i) => (
							<Finding key={i} finding={finding} open={i === 0} />
						))}
					</>
				)}
			</div>
		</div>
	);
}
