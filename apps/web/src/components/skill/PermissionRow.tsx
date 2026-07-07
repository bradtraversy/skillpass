import { PERMISSIONS, type PermissionKey, type RiskLevel } from 'skill-schema';
import { permissionLevel } from '../../lib/permission-level';

const LEVEL_TINT: Record<RiskLevel, string> = {
	low: 'text-risk-low border-pass-line bg-pass-soft',
	medium: 'text-risk-med border-warn-line bg-warn-soft',
	high: 'text-risk-high border-fail-line bg-fail-soft',
	critical: 'text-risk-crit border-fail-line bg-fail-soft',
};

// Icon chosen by the key's prefix, with a neutral fallback.
const ICONS: Record<string, React.ReactNode> = {
	filesystem: (
		<>
			<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" />
			<path d="M14 2v6h6" />
		</>
	),
	network: (
		<>
			<circle cx="12" cy="12" r="10" />
			<path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
		</>
	),
	env: (
		<>
			<rect x="3" y="11" width="18" height="11" rx="2" />
			<path d="M7 11V7a5 5 0 0 1 10 0v4" />
		</>
	),
	shell: (
		<>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" x2="20" y1="19" y2="19" />
		</>
	),
	fallback: (
		<>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 16v-4M12 8h.01" />
		</>
	),
};

export default function PermissionRow({ permKey }: { permKey: PermissionKey }) {
	const definition = PERMISSIONS.find((p) => p.key === permKey);
	const level = permissionLevel(permKey);
	const icon = ICONS[permKey.split('.')[0]] ?? ICONS.fallback;

	return (
		<div className="flex items-center gap-[13px] py-[11px]">
			<div className="grid size-[30px] flex-none place-items-center rounded-[8px] border border-border bg-surface-2 text-muted">
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
					{icon}
				</svg>
			</div>

			<div className="min-w-0">
				<div className="font-mono text-[13px]">{permKey}</div>
				<div className="mt-px text-[12.5px] text-muted">{definition?.description}</div>
			</div>

			<span
				className={`ml-auto flex-none rounded-[5px] border px-[9px] py-[3px] font-mono text-[10.5px] font-bold tracking-[0.06em] ${LEVEL_TINT[level]}`}
			>
				{level.toUpperCase()}
			</span>
		</div>
	);
}
