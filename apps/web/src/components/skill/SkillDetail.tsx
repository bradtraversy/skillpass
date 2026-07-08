import { useEffect, useState } from 'react';
import type { PublicSkillDetail } from 'skill-schema';
import { getSkill } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import DetailHeader from './DetailHeader';
import InstallBar from './InstallBar';
import Passport from './Passport';
import SourceView from './SourceView';
import Stamp from './Stamp';

const SECTION_HEADING = 'mb-[13px] font-mono text-[11px] uppercase tracking-[0.12em] text-faint';

type LoadState =
	| { phase: 'loading' }
	| { phase: 'notfound' }
	| { phase: 'error'; message: string }
	| { phase: 'ready'; detail: PublicSkillDetail };

export default function SkillDetail({ slug, version }: { slug: string; version?: string }) {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });

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
			<InstallBar slug={detail.slug} version={detail.version} />
			<Passport detail={detail} />

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
				<h2 className={SECTION_HEADING}>Maintainer</h2>
				<div className="flex items-center gap-[12px]">
					<img
						src={detail.maintainerInfo.avatarUrl}
						alt=""
						className="size-[38px] flex-none rounded-full"
					/>
					<div>
						<div className="font-semibold">{detail.maintainerInfo.username}</div>
						<div className="mt-[2px] text-[12px] text-faint">
							{detail.maintainerInfo.displayName}
							{detail.attributedTo && (
								<>
									{' '}
									· curated from <span className="font-mono">{detail.attributedTo}</span>'s repo
								</>
							)}
						</div>
					</div>
				</div>
			</section>

			<footer className="py-[46px] text-center text-[12.5px] text-faint">
				Passport is immutable and pinned to source hash{' '}
				<span className="font-mono">{detail.passport.sourceHash}</span>.
			</footer>
		</>
	);
}
