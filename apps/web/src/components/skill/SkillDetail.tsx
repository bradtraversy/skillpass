import { useEffect, useState } from 'react';
import type { PublicSkillDetail } from 'skill-schema';
import { getSkill } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import AiReview from './AiReview';
import DetailHeader from './DetailHeader';
import InstallBar from './InstallBar';
import Passport from './Passport';
import ReportPanel from './ReportPanel';
import SourceView from './SourceView';
import Stamp from './Stamp';
import { SECTION_HEADING } from '../../lib/classes';


type LoadState =
	| { phase: 'loading' }
	| { phase: 'notfound' }
	| { phase: 'error'; message: string }
	| { phase: 'ready'; detail: PublicSkillDetail };

export default function SkillDetail({ slug, version }: { slug: string; version?: string }) {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
	const [reportOpen, setReportOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void getSkill(slug, version).then((res) => {
			if (cancelled) return;
			if (res.success) {
				setLoad({ phase: 'ready', detail: res.data });
			} else if (res.status === 404) {
				setLoad({ phase: 'notfound' });
			} else {
				setLoad({ phase: 'error', message: res.error });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [slug, version]);

	if (load.phase === 'loading') {
		return <p className="py-16 text-center text-[13px] text-muted">Loading skill...</p>;
	}
	if (load.phase === 'notfound') {
		return (
			<p className="py-16 text-center text-[13px] text-muted">
				This skill {version ? 'version ' : ''}doesn't exist or isn't published.
			</p>
		);
	}
	if (load.phase === 'error') {
		return (
			<p className="py-16 text-center text-[13px] text-fail">
				Can't reach the API - is it running?
			</p>
		);
	}

	const { detail } = load;
	return (
		<>
			<DetailHeader detail={detail} />
			<InstallBar
				slug={detail.slug}
				version={detail.version}
				distribution={detail.passport.distribution ?? 'skill'}
				install={detail.passport.install}
				homepage={detail.passport.homepage}
				githubRepoUrl={detail.githubRepoUrl}
			/>
			<Passport detail={detail} />
			<AiReview review={detail.aiReview} />

			{(detail.packMembers?.length ?? 0) > 0 && (
				<section className="mt-[26px]">
					<h2 className={SECTION_HEADING}>Skills in this pack</h2>
					<p className="mb-1 text-[12px] text-faint">
						{detail.packMembers?.length} skills that install together - the passport above covers
						the whole pack.
					</p>
					<div className="divide-y divide-border">
						{detail.packMembers?.map((member) => (
							<div key={member.name} className="flex items-baseline gap-[12px] py-[10px] text-[13px]">
								<span className="flex-none font-mono text-text">{member.name}</span>
								{member.targets &&
									(member.targets.length !== detail.targets.length ||
										!member.targets.every((t) => detail.targets.includes(t))) && (
										<span className="flex flex-none gap-[5px]">
											{member.targets.map((t) => (
												<span
													key={t}
													className="rounded-[5px] border border-border-2 px-[6px] py-[1px] font-mono text-[10px] text-muted"
												>
													{t}
												</span>
											))}
										</span>
									)}
								<span className="min-w-0 flex-1 truncate text-muted">{member.description}</span>
							</div>
						))}
					</div>
				</section>
			)}

			<section className="mt-[26px]">
				<h2 className={SECTION_HEADING}>Source</h2>
				<SourceView slug={detail.slug} version={detail.version} />
			</section>

			<section className="mt-[26px]">
				<h2 className={SECTION_HEADING}>Versions</h2>
				<div className="divide-y divide-border">
					{detail.versions.map((v) => (
						<a
							key={v.version}
							href={`/skills/${detail.slug}/${v.version}`}
							className="flex items-center gap-[11px] py-[11px] text-[13px] hover:bg-surface"
						>
							<span className="font-mono text-text">
								v{v.version}
								{v.version === detail.version && version ? ' (viewing)' : ''}
							</span>
							<Stamp verdict={v.validationStatus} />
							<span className="ml-auto text-[12px] text-faint">{timeAgo(v.publishedAt)}</span>
						</a>
					))}
				</div>
			</section>

			<section className="mt-[26px]">
				<h2 className={SECTION_HEADING}>{detail.attributedTo ? 'Author' : 'Maintainer'}</h2>
				{detail.attributedTo ? (
					<div className="flex items-center gap-[12px]">
						<img
							src={`https://github.com/${detail.attributedTo}.png?size=76`}
							alt=""
							className="size-[38px] flex-none rounded-full"
						/>
						<div>
							<a
								href={`https://github.com/${detail.attributedTo}`}
								target="_blank"
								rel="noreferrer"
								className="font-semibold hover:underline"
							>
								{detail.attributedTo}
							</a>
							<div className="mt-[2px] text-[12px] text-faint">
								curated by{' '}
								<a href={`/u/${detail.maintainerInfo.username}`} className="hover:text-text">
									{detail.maintainerInfo.username}
								</a>
							</div>
						</div>
					</div>
				) : (
					<a
						href={`/u/${detail.maintainerInfo.username}`}
						className="flex items-center gap-[12px] rounded-md hover:bg-surface"
					>
						<img
							src={detail.maintainerInfo.avatarUrl}
							alt=""
							className="size-[38px] flex-none rounded-full"
						/>
						<div>
							<div className="font-semibold">{detail.maintainerInfo.username}</div>
							<div className="mt-[2px] text-[12px] text-faint">
								{detail.maintainerInfo.displayName}
							</div>
						</div>
					</a>
				)}
			</section>

			<section className="mt-[22px]">
				{!reportOpen ? (
					<button
						type="button"
						onClick={() => setReportOpen(true)}
						className="cursor-pointer text-[12px] text-faint underline decoration-dotted underline-offset-2 hover:text-fail"
					>
						Report this skill
					</button>
				) : (
					<ReportPanel slug={detail.slug} onClose={() => setReportOpen(false)} />
				)}
			</section>

			<footer className="py-[46px] text-center text-[12.5px] text-faint">
				Passport is immutable and pinned to source hash{' '}
				<span className="font-mono">{detail.passport.sourceHash}</span>.
			</footer>
		</>
	);
}
