// Tracks the newest of overlapping async requests so a slow, stale response
// can be dropped once a newer request has started.
export function latestOnly() {
	let current = 0;
	return {
		start: (): number => ++current,
		isCurrent: (token: number): boolean => token === current,
	};
}
