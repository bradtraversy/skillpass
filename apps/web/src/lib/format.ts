// Presentational helpers for skill rows. Pure and reusable (Row.astro now, the
// Directory island later). Monogram is derived, not stored on the Skill contract.

export function monogram(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = words[0]?.[0] ?? '';
	const last = words.length > 1 ? words[words.length - 1][0] : (words[0]?.[1] ?? '');
	return (first + last).toUpperCase();
}

export function formatInstalls(installs: number): string {
	if (installs <= 0) return 'held';
	if (installs >= 1000) return `${(installs / 1000).toFixed(1)}k`;
	return String(installs);
}
