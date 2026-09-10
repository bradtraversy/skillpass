import type { ReactNode } from 'react';

export interface IconProps {
	size?: number;
	strokeWidth?: number;
	className?: string;
}

function Icon({ size = 15, strokeWidth = 2, className, children }: IconProps & { children: ReactNode }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

const SHIELD = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';

export const CloseIcon = (p: IconProps) => (
	<Icon {...p}>
		<path d="M18 6 6 18M6 6l12 12" />
	</Icon>
);

export const CheckIcon = (p: IconProps) => (
	<Icon {...p}>
		<path d="M20 6 9 17l-5-5" />
	</Icon>
);

export const DownloadIcon = (p: IconProps) => (
	<Icon {...p}>
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<path d="M7 10l5 5 5-5M12 15V3" />
	</Icon>
);

export const ShieldIcon = (p: IconProps) => (
	<Icon {...p}>
		<path d={SHIELD} />
	</Icon>
);

export const ShieldCheckIcon = (p: IconProps) => (
	<Icon {...p}>
		<path d={SHIELD} />
		<path d="m9 12 2 2 4-4" />
	</Icon>
);

export const FileIcon = (p: IconProps) => (
	<Icon {...p}>
		<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" />
		<path d="M14 2v6h6" />
	</Icon>
);

export const AlertIcon = (p: IconProps) => (
	<Icon {...p}>
		<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
		<path d="M12 9v4M12 17h.01" />
	</Icon>
);
