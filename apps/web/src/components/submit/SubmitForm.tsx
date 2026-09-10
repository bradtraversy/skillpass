import { useEffect, useState, type SubmitEvent } from 'react';
import { MAX_ZIP_BYTES, type CreatedSubmission, type PublicUser } from 'skill-schema';
import { getMe, signInUrl, submitGithubUrl, submitZip } from '../../lib/api';
import { detectionSummary } from '../../lib/detection-summary';
import ValidationProgress from './ValidationProgress';

type AuthState =
	| { state: 'checking' }
	| { state: 'signed-out' }
	| { state: 'signed-in'; user: PublicUser };

type Mode = 'url' | 'zip';

export default function SubmitForm() {
	const [auth, setAuth] = useState<AuthState>({ state: 'checking' });
	const [mode, setMode] = useState<Mode>('url');
	const [url, setUrl] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [result, setResult] = useState<CreatedSubmission | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		getMe().then((res) =>
			setAuth(res.success ? { state: 'signed-in', user: res.data } : { state: 'signed-out' }),
		);
	}, []);

	function switchMode(next: Mode) {
		setMode(next);
		setError(null);
		setResult(null);
	}

	async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		setResult(null);

		if (mode === 'zip') {
			if (!file) {
				setError('choose a zip file first');
				return;
			}
			if (file.size > MAX_ZIP_BYTES) {
				setError(
					`"${file.name}" is over the ${MAX_ZIP_BYTES / 1024 / 1024} MB zip limit - nothing was uploaded`,
				);
				return;
			}
		}

		setSubmitting(true);
		const res =
			mode === 'url' ? await submitGithubUrl(url.trim()) : await submitZip(file as File);
		setSubmitting(false);
		if (res.success) {
			setResult(res.data);
			setUrl('');
			setFile(null);
		} else {
			setError(res.error);
		}
	}

	if (auth.state === 'checking') {
		return <p className="mt-10 text-[13px] text-faint">Checking session...</p>;
	}

	if (auth.state === 'signed-out') {
		return (
			<div className="mt-10 rounded-lg border border-border bg-surface p-8 text-center">
				<h2 className="font-semibold">Sign in to submit</h2>
				<p className="mx-auto mt-2 max-w-[400px] text-[13.5px] text-muted">
					Submissions are tied to your GitHub account. You can submit repositories you own, or
					org repositories where your membership is public.
				</p>
				<a
					href={signInUrl()}
					className="mt-5 inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-[9px] text-[13.5px] font-semibold text-accent-ink hover:bg-accent-hover"
				>
					Sign in with GitHub
				</a>
				<p className="mt-3 text-[12px] text-faint">
					If this keeps showing after signing in, the API may not be running.
				</p>
			</div>
		);
	}

	return (
		<div className="mt-10">
			<p className="flex items-center gap-2 text-[13px] text-muted">
				<img src={auth.user.avatarUrl} alt="" className="size-5 rounded-full" />
				Signed in as <b className="font-medium text-text">{auth.user.username}</b>
			</p>

			<div className="mt-4 flex w-fit gap-1 rounded-sm border border-border-2 bg-surface p-1">
				{(['url', 'zip'] as const).map((m) => (
					<button
						key={m}
						type="button"
						onClick={() => switchMode(m)}
						className={`rounded-[4px] px-3 py-[6px] text-[13px] font-medium ${
							mode === m ? 'bg-hover text-text' : 'cursor-pointer text-muted hover:text-text'
						}`}
					>
						{m === 'url' ? 'GitHub URL' : 'Zip upload'}
					</button>
				))}
			</div>

			<form onSubmit={onSubmit} className="mt-4">
				{mode === 'url' ? (
					<>
						<label htmlFor="github-url" className="text-[13px] font-medium text-muted">
							GitHub repository URL
						</label>
						<div className="mt-2 flex items-center gap-3">
							<input
								id="github-url"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								placeholder="https://github.com/you/your-skill or .../tree/main/skills/name"
								required
								className="flex-1 rounded-sm border border-border-2 bg-surface px-4 py-[11px] text-[14px] text-text outline-none placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_4px_var(--ring)]"
							/>
							<SubmitButton submitting={submitting} label="Pinning..." />
						</div>
						<p className="mt-2 text-[12px] text-faint">
							The whole repo, or one skill inside it via a /tree/branch/folder URL. The commit is
							pinned and the source snapshotted before anything else happens.
						</p>
					</>
				) : (
					<>
						<label htmlFor="zip-file" className="text-[13px] font-medium text-muted">
							Skill package zip
						</label>
						<div className="mt-2 flex items-center gap-3">
							<label className="flex flex-1 cursor-pointer items-center gap-3 rounded-sm border border-border-2 bg-surface px-4 py-[11px] text-[14px] hover:bg-hover">
								<span className="rounded-[5px] border border-border-2 px-[7px] py-[2px] font-mono text-[11px] text-muted">
									choose
								</span>
								<span className={file ? 'truncate text-text' : 'text-faint'}>
									{file ? file.name : 'No zip selected'}
								</span>
								<input
									id="zip-file"
									type="file"
									accept=".zip,application/zip"
									required
									onChange={(e) => setFile(e.target.files?.[0] ?? null)}
									className="sr-only"
								/>
							</label>
							<SubmitButton submitting={submitting} label="Uploading..." />
						</div>
						<p className="mt-2 text-[12px] text-faint">
							For skills not hosted on GitHub. Max {MAX_ZIP_BYTES / 1024 / 1024} MB. You must own
							or have permission to share what you upload.
						</p>
					</>
				)}
			</form>

			{error && (
				<div className="mt-5 rounded-sm border border-fail-line bg-fail-soft px-4 py-3 text-[13.5px] text-fail">
					{error}
				</div>
			)}

			{result && <ResultCard key={result.id} submission={result} />}
		</div>
	);
}

function SubmitButton({ submitting, label }: { submitting: boolean; label: string }) {
	return (
		<button
			type="submit"
			disabled={submitting}
			className="rounded-sm bg-accent px-5 py-[11px] text-[13.5px] font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
		>
			{submitting ? label : 'Submit'}
		</button>
	);
}

function ResultCard({ submission }: { submission: CreatedSubmission }) {
	const detection = detectionSummary(submission.detected);
	return (
		<div className="mt-5 rounded-lg border border-border bg-surface p-5">
			<p className="flex items-center gap-2 font-semibold">
				Draft created
				<span className="rounded-[5px] border border-border-2 px-[7px] py-[2px] font-mono text-[11px] uppercase tracking-wide text-muted">
					{submission.status}
				</span>
			</p>
			<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[13px]">
				{submission.githubUrl && (
					<>
						<dt className="text-faint">source</dt>
						<dd className="truncate text-muted">{submission.githubUrl}</dd>
					</>
				)}
				{submission.resolvedCommitSha && (
					<>
						<dt className="text-faint">pinned commit</dt>
						<dd className="font-mono text-muted">{submission.resolvedCommitSha.slice(0, 12)}</dd>
					</>
				)}
				<dt className="text-faint">source hash</dt>
				<dd className="truncate font-mono text-muted">{submission.sourceHash}</dd>
				<dt className="text-faint">detected</dt>
				<dd className={detection.tone}>{detection.text}</dd>
			</dl>
			<ValidationProgress submissionId={submission.id} />
			<p className="mt-3 text-[12px] text-faint">
				Your draft is stored and pinned. Nothing is public until it passes and you publish.
			</p>
		</div>
	);
}
