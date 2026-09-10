import { INTEGRATIONS, type PublicSkillDetail } from 'skill-schema';
import { monogram, repoHandle } from '../../lib/format';
import { ShieldCheckIcon } from '../ui/icons';

export default function DetailHeader({ detail }: { detail: PublicSkillDetail }) {
	const title = detail.displayName ?? detail.name;
	const worksWith = (detail.integrations ?? [])
		.map((slug) => INTEGRATIONS.find((i) => i.slug === slug)?.label)
		.filter((label): label is string => label != null);
	return (
		<div className="flex items-start gap-[18px] pt-5 pb-6">
			<div className="grid size-[52px] flex-none place-items-center rounded-[13px] border border-border-2 bg-surface-2 font-mono font-semibold text-accent">
				{monogram(title)}
			</div>

			<div className="min-w-0">
				<div className="flex flex-wrap items-baseline gap-x-3">
					<h1 className="text-[27px] font-[640] tracking-[-0.02em]">{title}</h1>
					{detail.displayName && (
						<span className="font-mono text-[13px] text-faint">{detail.slug}</span>
					)}
				</div>
				<p className="mt-[5px] text-[15px] text-muted">{detail.summary}</p>
				<div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px] text-muted">
					{detail.targets.map((target) => (
						<span
							key={target}
							className="rounded-[4px] border border-border px-[6px] py-px font-mono text-[10.5px] text-muted"
						>
							{target}
						</span>
					))}
					{worksWith.length > 0 && (
						<span className="inline-flex items-center gap-[6px]">
							<span aria-hidden="true">·</span>
							<span className="text-faint">works with</span>
							{worksWith.map((label) => (
								<span
									key={label}
									className="rounded-[4px] border border-border px-[6px] py-px font-mono text-[10.5px] text-muted"
								>
									{label}
								</span>
							))}
						</span>
					)}
					{detail.githubRepoUrl && (
						<span className="inline-flex items-center gap-[6px]">
							<span aria-hidden="true">·</span>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49l-.01-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
							</svg>
							<a
								href={detail.githubRepoUrl}
								target="_blank"
								rel="noreferrer noopener"
								className="text-accent hover:underline"
							>
								{repoHandle(detail.githubRepoUrl)}
							</a>
						</span>
					)}
				</div>
			</div>

			<div className="ml-auto flex flex-none items-center gap-[7px] rounded-[7px] border border-border-2 bg-surface-2 px-[12px] py-[7px] font-mono text-[12px] font-semibold text-muted max-[620px]:hidden">
				<ShieldCheckIcon strokeWidth={2.2} className="flex-none text-accent" />
				Validated
			</div>
		</div>
	);
}
