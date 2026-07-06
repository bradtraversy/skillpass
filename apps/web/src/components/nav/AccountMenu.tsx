import { useEffect, useRef, useState } from 'react';
import { getMe, logout, signInUrl, type CurrentUser } from '../../lib/api';

type AuthState =
	| { state: 'checking' }
	| { state: 'signed-out' }
	| { state: 'signed-in'; user: CurrentUser };

export default function AccountMenu() {
	const [auth, setAuth] = useState<AuthState>({ state: 'checking' });
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		getMe().then((res) =>
			setAuth(res.success ? { state: 'signed-in', user: res.data } : { state: 'signed-out' }),
		);
	}, []);

	useEffect(() => {
		if (!open) return;
		function onPointerDown(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener('mousedown', onPointerDown);
		return () => document.removeEventListener('mousedown', onPointerDown);
	}, [open]);

	async function onSignOut() {
		await logout();
		// Full reload so every island on the page resyncs to the cleared session.
		window.location.reload();
	}

	if (auth.state === 'checking') {
		return null;
	}

	if (auth.state === 'signed-out') {
		return (
			<a href={signInUrl()} className="hover:text-text">
				Sign in
			</a>
		);
	}

	return (
		<div ref={menuRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				className="flex cursor-pointer items-center gap-2 font-medium text-muted hover:text-text"
			>
				<img src={auth.user.avatarUrl} alt="" className="size-6 rounded-full" />
				{auth.user.username}
			</button>
			{open && (
				<div className="absolute right-0 top-[calc(100%+12px)] z-10 min-w-[150px] rounded-sm border border-border-2 bg-surface p-1 shadow-lg">
					<button
						type="button"
						onClick={onSignOut}
						className="w-full cursor-pointer rounded-[4px] px-3 py-2 text-left text-[13px] text-muted hover:bg-hover hover:text-text"
					>
						Sign out
					</button>
				</div>
			)}
		</div>
	);
}
