import { useState } from 'react';
import type { PublicSkillSource } from 'skill-schema';
import { getSkillSource } from '../../lib/api';
import { renderMarkdown } from '../../lib/markdown';
import { FileIcon } from '../ui/icons';

type LoadState = 'closed' | 'loading' | 'error' | PublicSkillSource;

function formatBytes(n: number): string {
	return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

// Lazily fetches the pinned snapshot on first expand - the exact files the
// validator saw. SKILL.md renders as markdown; everything else stays verbatim.
export default function SourceView({ slug, version }: { slug: string; version: string }) {
	const [state, setState] = useState<LoadState>('closed');
	const [openPath, setOpenPath] = useState<string | null>(null);

	async function open() {
		setState('loading');
		const res = await getSkillSource(slug, version);
		if (res.success) {
			setState(res.data);
			setOpenPath(res.data.files.find((f) => f.path.toLowerCase() === 'skill.md')?.path ?? null);
		} else {
			setState('error');
		}
	}

	if (state === 'closed' || state === 'loading' || state === 'error') {
		return (
			<div>
				<button
					type="button"
					onClick={open}
					disabled={state === 'loading'}
					className="cursor-pointer rounded-sm border border-border-2 bg-surface px-[13px] py-[8px] text-[12.5px] font-semibold text-muted hover:bg-hover hover:text-text disabled:opacity-60"
				>
					{state === 'loading' ? 'Loading source...' : 'View validated source'}
				</button>
				{state === 'error' && <p className="mt-2 text-[12.5px] text-fail">Could not load the source - try again.</p>}
			</div>
		);
	}

	return (
		<>
			<p className="mb-[10px] font-mono text-[11px] text-faint">
				pinned to <span className="break-all">{state.sourceHash}</span>
			</p>
			<div className="divide-y divide-border rounded-md border border-border bg-surface">
				{state.files.map((file) => (
					<div key={file.path}>
						<button
							type="button"
							onClick={() => setOpenPath(openPath === file.path ? null : file.path)}
							className="flex w-full cursor-pointer items-center gap-[11px] px-[14px] py-[11px] text-[13px] hover:bg-hover"
						>
							<FileIcon className="flex-none text-faint" />
							<span className="font-mono text-text">{file.path}</span>
							<span className="ml-auto text-[12px] text-faint">{formatBytes(file.content.length)}</span>
							<svg
								className={`flex-none text-faint transition-transform ${openPath === file.path ? 'rotate-90' : ''}`}
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="m9 18 6-6-6-6" />
							</svg>
						</button>
						{openPath === file.path && (
							<div className="border-t border-border bg-bg-well px-[16px] py-[6px]">
								{file.path.toLowerCase().endsWith('.md') ? (
									<div className="py-[6px]">{renderMarkdown(file.content)}</div>
								) : (
									<pre className="overflow-x-auto py-[10px] font-mono text-[12.5px] leading-[1.6] text-muted">
										{file.content}
									</pre>
								)}
							</div>
						)}
					</div>
				))}
			</div>
		</>
	);
}
