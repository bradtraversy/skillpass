export const PAGE_SIZE = 25;

export interface Page<T> {
	items: T[];
	page: number;
	pageCount: number;
	total: number;
	start: number;
}

export function paginate<T>(items: T[], requestedPage: number, pageSize = PAGE_SIZE): Page<T> {
	const total = items.length;
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const wanted = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
	const page = Math.min(Math.max(1, wanted), pageCount);
	const offset = (page - 1) * pageSize;
	return {
		items: items.slice(offset, offset + pageSize),
		page,
		pageCount,
		total,
		start: offset + 1,
	};
}

// Page-control model: every page when few, otherwise first/last plus the
// current page's neighbors with gaps.
export function pageItems(page: number, pageCount: number): (number | 'gap')[] {
	if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
	const wanted = new Set([1, 2, page - 1, page, page + 1, pageCount - 1, pageCount]);
	const items: (number | 'gap')[] = [];
	for (let n = 1; n <= pageCount; n++) {
		if (wanted.has(n)) items.push(n);
		else if (items[items.length - 1] !== 'gap') items.push('gap');
	}
	return items;
}
