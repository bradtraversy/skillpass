// The static web site enumerates skill/profile pages at build time, so a publish
// only becomes a visitable page after a rebuild. Firing Render's deploy hook on
// publish closes that gap. Best-effort: a hook failure must never fail publish.
export async function triggerRebuild(
	hookUrl: string | undefined,
	fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
	if (!hookUrl) return false;
	try {
		const res = await fetchImpl(hookUrl, { method: 'POST' });
		if (!res.ok) {
			console.error(`rebuild hook returned ${res.status}`);
			return false;
		}
		return true;
	} catch (err) {
		console.error('rebuild hook failed', err);
		return false;
	}
}
