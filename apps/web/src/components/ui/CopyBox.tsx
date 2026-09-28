import { useState } from 'react';

interface Props {
	value: string;
	label: string;
	prefix?: string;
}

export default function CopyBox({ value, label, prefix }: Props) {
	const [copied, setCopied] = useState(false);
	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		} catch {
			// Clipboard unavailable (insecure context or denied); the value stays visible.
		}
	}
	return (
		<div className="flex flex-1 items-center gap-[10px] rounded-sm border border-border-2 bg-bg-well px-3 py-[9px]">
			{prefix && <span className="font-mono text-accent">{prefix}</span>}
			<span className="flex-1 truncate font-mono text-[12.5px]">{value}</span>
			<button
				type="button"
				onClick={copy}
				aria-label={label}
				className="grid cursor-pointer place-items-center text-faint hover:text-text"
			>
				{copied ? (
					<svg
						className="text-pass"
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
						<path d="M20 6 9 17l-5-5" />
					</svg>
				) : (
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
						<rect x="9" y="9" width="13" height="13" rx="2" />
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
					</svg>
				)}
			</button>
		</div>
	);
}
