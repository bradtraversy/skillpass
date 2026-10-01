import { useState } from 'react';
import type { Distribution } from 'skill-schema';
import { installPrompt, installRef } from '../../lib/install-prompt';
import CopyBox from '../ui/CopyBox';
import { DownloadIcon } from '../ui/icons';
import PreflightPanel from './PreflightPanel';

interface Props {
	slug: string;
	version: string;
	distribution: Distribution;
	install?: string;
	homepage?: string;
	githubRepoUrl: string | null;
	pinned: boolean;
}

type InstallMode = 'cli' | 'prompt';
const MODES: { id: InstallMode; label: string }[] = [
	{ id: 'cli', label: 'CLI' },
	{ id: 'prompt', label: 'Prompt' },
];
const TAB = 'cursor-pointer rounded-sm border px-[10px] py-[4px] font-mono text-[11px] uppercase tracking-[0.08em]';
const TAB_ON = 'border-border-2 bg-bg-well text-text';
const TAB_OFF = 'border-transparent text-faint hover:text-text';

const BTN =
	'inline-flex cursor-pointer items-center gap-[7px] rounded-sm bg-accent px-[15px] py-[9px] text-[13px] font-semibold text-accent-ink hover:bg-accent-hover';
const LINK_BTN =
	'inline-flex items-center gap-[7px] rounded-sm border border-border-2 px-[15px] py-[9px] text-[13px] font-semibold text-muted hover:text-text';

function ExternalIcon() {
	return (
		<svg
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
			<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
			<path d="M15 3h6v6M10 14 21 3" />
		</svg>
	);
}

export default function InstallBar({ slug, version, distribution, install, homepage, githubRepoUrl, pinned }: Props) {
	const [preflightOpen, setPreflightOpen] = useState(false);
	const [mode, setMode] = useState<InstallMode>('cli');
	const repoUrl = githubRepoUrl ?? homepage ?? null;

	// A downloadable skill: install command or agent prompt + the download/pre-flight flow.
	if (distribution === 'skill') {
		const ref = installRef(slug, version, pinned);
		return (
			<>
				<div className="rounded-md border border-border bg-surface p-[14px]">
					<div className="mb-[10px] flex gap-[4px]" role="tablist" aria-label="Install method">
						{MODES.map((m) => (
							<button
								key={m.id}
								type="button"
								role="tab"
								aria-selected={mode === m.id}
								onClick={() => setMode(m.id)}
								className={`${TAB} ${mode === m.id ? TAB_ON : TAB_OFF}`}
							>
								{m.label}
							</button>
						))}
					</div>
					{mode === 'cli' ? (
						<div className="flex items-center gap-3">
							<CopyBox value={`skillpass add ${ref}`} label="Copy command" prefix="$" />
							<button type="button" onClick={() => setPreflightOpen((open) => !open)} className={BTN}>
								<DownloadIcon />
								Download &amp; pre-flight
							</button>
						</div>
					) : (
						<CopyBox value={installPrompt({ slug, version, pinned })} label="Copy prompt" multiline />
					)}
					<p className="mt-[10px] text-[12px] text-faint">
						{mode === 'cli' ? (
							<>
								Needs the CLI: <code className="font-mono text-muted">npm install -g skillpass</code>
								{' · '}
								<a href="/install" className="text-muted hover:text-text">
									Install guide for your agent
								</a>
							</>
						) : (
							'Paste this into your agent. It runs the same CLI install, pre-flight first, and stops for you on medium or higher risk.'
						)}
					</p>
				</div>
				{preflightOpen && <PreflightPanel slug={slug} version={version} onClose={() => setPreflightOpen(false)} />}
			</>
		);
	}

	// A CLI tool: run an install command, link to the repo. No zip download.
	if (distribution === 'cli') {
		return (
			<div className="flex items-center gap-3 rounded-md border border-border bg-surface p-[14px]">
				{install ? (
					<CopyBox value={install} label="Copy command" prefix="$" />
				) : (
					<span className="flex-1 text-[13px] text-muted">Install from the repository.</span>
				)}
				{repoUrl && (
					<a href={repoUrl} target="_blank" rel="noreferrer" className={LINK_BTN}>
						<ExternalIcon />
						View repo
					</a>
				)}
			</div>
		);
	}

	// A system / framework: obtained from its repo (and docs). No download.
	return (
		<div className="flex items-center gap-3 rounded-md border border-border bg-surface p-[14px]">
			<span className="flex-1 text-[13px] text-muted">A full workflow system - get it from its repository.</span>
			{homepage && (
				<a href={homepage} target="_blank" rel="noreferrer" className={LINK_BTN}>
					<ExternalIcon />
					Docs
				</a>
			)}
			{githubRepoUrl && (
				<a href={githubRepoUrl} target="_blank" rel="noreferrer" className={BTN}>
					<ExternalIcon />
					View on GitHub
				</a>
			)}
		</div>
	);
}
