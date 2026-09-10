import { useEffect, useState } from 'react';
import type { PublicProfile } from 'skill-schema';
import { getProfile } from '../../lib/api';
import Row from '../skill/Row';
import { SECTION_HEADING } from '../../lib/classes';


type LoadState =
	| { phase: 'loading' }
	| { phase: 'notfound' }
	| { phase: 'error' }
	| { phase: 'ready'; profile: PublicProfile };

export default function Profile({ username }: { username: string }) {
	const [load, setLoad] = useState<LoadState>({ phase: 'loading' });

	useEffect(() => {
		let cancelled = false;
		void getProfile(username).then((res) => {
			if (cancelled) return;
			if (res.success) {
				setLoad({ phase: 'ready', profile: res.data });
			} else if (res.status === 404) {
				setLoad({ phase: 'notfound' });
			} else {
				setLoad({ phase: 'error' });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [username]);

	if (load.phase === 'loading') {
		return <p className="py-16 text-center text-[13px] text-muted">Loading profile...</p>;
	}
	if (load.phase === 'notfound') {
		return (
			<p className="py-16 text-center text-[13px] text-muted">
				No maintainer named {username} here.
			</p>
		);
	}
	if (load.phase === 'error') {
		return (
			<p className="py-16 text-center text-[13px] text-fail">Can't reach the API - is it running?</p>
		);
	}

	const { profile } = load;
	const joined = new Date(profile.joinedAt).toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
	});

	return (
		<>
			<header className="flex items-center gap-[18px] pt-[34px] pb-[30px]">
				<img src={profile.avatarUrl} alt="" className="size-[72px] flex-none rounded-full" />
				<div className="min-w-0">
					<h1 className="text-[22px] font-bold tracking-[-0.01em]">{profile.displayName}</h1>
					<div className="mt-[3px] text-[13px] text-muted">@{profile.username}</div>
					<div className="mt-[7px] flex items-center gap-[14px] text-[12.5px] text-faint">
						<span>
							<b className="font-mono text-[13px] font-semibold text-text">{profile.reputation}</b>{' '}
							reputation
						</span>
						<span>joined {joined}</span>
					</div>
				</div>
			</header>

			<section>
				<h2 className={SECTION_HEADING}>
					Published skills ({profile.skills.length})
				</h2>
				{profile.skills.length === 0 ? (
					<p className="py-[14px] text-[13px] text-muted">Nothing published yet.</p>
				) : (
					<div>
						{profile.skills.map((skill, i) => (
							<Row key={skill.slug} skill={skill} rank={i + 1} />
						))}
					</div>
				)}
			</section>
		</>
	);
}
