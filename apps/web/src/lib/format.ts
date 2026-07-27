// Presentational helpers for skill rows. Pure and reusable across the Directory
// island and the detail page. Monogram is derived, not stored on the contract.

export function monogram(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = words[0]?.[0] ?? '';
	const last = words.length > 1 ? words[words.length - 1][0] : (words[0]?.[1] ?? '');
	return (first + last).toUpperCase();
}

// Coarse relative time for "published X ago" columns. Clamps future/skewed
// timestamps to "just now".
export function timeAgo(iso: string, now: Date = new Date()): string {
	const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo ago`;
	return `${Math.floor(days / 365)}y ago`;
}

// Falls back to the raw input for a non-GitHub/malformed URL instead of throwing.
export function repoHandle(url: string): string {
	const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
	return match ? `${match[1]}/${match[2]}` : url;
}

// Listing fallback when a skill has no tagline: the first sentence of the
// agent-facing summary, dropping its "Use when..." trigger clause. The
// terminator must be followed by whitespace so "22.12" or "e.g" don't split.
export function firstSentence(text: string): string {
	const match = text.match(/^.*?[.!?](?=\s|$)/);
	return (match?.[0] ?? text).trim();
}
