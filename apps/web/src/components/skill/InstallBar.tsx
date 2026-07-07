import { useState } from 'react';

export default function InstallBar({ slug }: { slug: string }) {
	const [copied, setCopied] = useState(false);
	const command = `aiskills add ${slug}`;

	async function copy() {
		try {
			await navigator.clipboard.writeText(command);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		} catch {
			// Clipboard unavailable (insecure context or denied); the command stays visible.
		}
	}

	return (
		<div className="flex items-center gap-3 rounded-md border border-border bg-surface p-[14px]">
			<div className="flex flex-1 items-center gap-[10px] rounded-sm border border-border-2 bg-bg-well px-3 py-[9px]">
				<span className="font-mono text-accent">$</span>
				<span className="flex-1 font-mono text-[12.5px]">{command}</span>
				<button
					type="button"
					onClick={copy}
					aria-label="Copy install command"
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
			<a
				href="#"
				className="inline-flex items-center gap-[7px] rounded-sm bg-accent px-[15px] py-[9px] text-[13px] font-semibold text-accent-ink hover:bg-accent-hover"
			>
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
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<path d="M7 10l5 5 5-5M12 15V3" />
				</svg>
				Download &amp; pre-flight
			</a>
		</div>
	);
}
