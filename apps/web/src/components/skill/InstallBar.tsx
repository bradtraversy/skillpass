import { useState } from 'react';
import type { Distribution } from 'skill-schema';
import PreflightPanel from './PreflightPanel';

interface Props {
	slug: string;
	version: string;
	distribution: Distribution;
	install?: string;
	homepage?: string;
	githubRepoUrl: string | null;
}

const BTN =
	'inline-flex cursor-pointer items-center gap-[7px] rounded-sm bg-accent px-[15px] py-[9px] text-[13px] font-semibold text-accent-ink hover:bg-accent-hover';
const LINK_BTN =
	'inline-flex items-center gap-[7px] rounded-sm border border-border-2 px-[15px] py-[9px] text-[13px] font-semibold text-muted hover:text-text';

function DownloadIcon() {
	return (
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<path d="M7 10l5 5 5-5M12 15V3" />
		</svg>
	);
}

function ExternalIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
			<path d="M15 3h6v6M10 14 21 3" />
		</svg>
	);
}

function CopyBox({ command }: { command: string }) {
	const [copied, setCopied] = useState(false);
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
		<div className="flex flex-1 items-center gap-[10px] rounded-sm border border-border-2 bg-bg-well px-3 py-[9px]">
			<span className="font-mono text-accent">$</span>
			<span className="flex-1 truncate font-mono text-[12.5px]">{command}</span>
			<button
				type="button"
				onClick={copy}
				aria-label="Copy command"
				className="grid cursor-pointer place-items-center text-faint hover:text-text"
			>
				{copied ? (
					<svg className="text-pass" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M20 6 9 17l-5-5" />
					</svg>
				) : (
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<rect x="9" y="9" width="13" height="13" rx="2" />
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
					</svg>
				)}
			</button>
		</div>
	);
}

export default function InstallBar({ slug, version, distribution, install, homepage, githubRepoUrl }: Props) {
	const [preflightOpen, setPreflightOpen] = useState(false);
	const repoUrl = githubRepoUrl ?? homepage ?? null;

	// A downloadable skill: install command + the download/pre-flight flow.
	if (distribution === 'skill') {
		return (
			<>
				<div className="rounded-md border border-border bg-surface p-[14px]">
					<div className="flex items-center gap-3">
						<CopyBox command={`skillpass add ${slug}`} />
						<button type="button" onClick={() => setPreflightOpen((open) => !open)} className={BTN}>
							<DownloadIcon />
							Download &amp; pre-flight
						</button>
					</div>
					<p className="mt-[10px] text-[12px] text-faint">
						Needs the CLI: <code className="font-mono text-muted">npm install -g skillpass</code>
					</p>
				</div>
				{preflightOpen && (
					<PreflightPanel slug={slug} version={version} onClose={() => setPreflightOpen(false)} />
				)}
			</>
		);
	}

	// A CLI tool: run an install command, link to the repo. No zip download.
	if (distribution === 'cli') {
		return (
			<div className="flex items-center gap-3 rounded-md border border-border bg-surface p-[14px]">
				{install ? (
					<CopyBox command={install} />
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
			<span className="flex-1 text-[13px] text-muted">
				A full workflow system - get it from its repository.
			</span>
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
