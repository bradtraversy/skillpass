import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, paginate, pageItems } from './paginate';

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('paginate', () => {
	it('returns everything on one page when under the page size', () => {
		const page = paginate(items(10), 1);
		expect(page).toMatchObject({ page: 1, pageCount: 1, total: 10, start: 1 });
		expect(page.items).toHaveLength(10);
	});

	it('slices the requested page and numbers start for rank continuation', () => {
		const page = paginate(items(60), 2);
		expect(page).toMatchObject({ page: 2, pageCount: 3, total: 60, start: PAGE_SIZE + 1 });
		expect(page.items[0]).toBe(PAGE_SIZE + 1);
		expect(page.items).toHaveLength(PAGE_SIZE);
	});

	it('gives the last page its remainder', () => {
		const page = paginate(items(60), 3);
		expect(page.items).toHaveLength(60 - 2 * PAGE_SIZE);
	});

	it('clamps a page beyond the end back to the last page', () => {
		expect(paginate(items(60), 99).page).toBe(3);
	});

	it('clamps zero, negative, and non-finite pages to 1', () => {
		expect(paginate(items(60), 0).page).toBe(1);
		expect(paginate(items(60), -4).page).toBe(1);
		expect(paginate(items(60), Number.NaN).page).toBe(1);
	});

	it('handles an empty list as a single empty page', () => {
		expect(paginate([], 1)).toMatchObject({ items: [], page: 1, pageCount: 1, total: 0 });
	});

	it('respects a custom page size', () => {
		expect(paginate(items(9), 2, 4).items).toEqual([5, 6, 7, 8]);
	});
});

describe('pageItems', () => {
	it('lists every page when there are few', () => {
		expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
	});

	it('condenses long ranges around the current page', () => {
		expect(pageItems(5, 10)).toEqual([1, 2, 'gap', 4, 5, 6, 'gap', 9, 10]);
	});

	it('avoids gaps when the current page touches an edge', () => {
		expect(pageItems(1, 10)).toEqual([1, 2, 'gap', 9, 10]);
		expect(pageItems(10, 10)).toEqual([1, 2, 'gap', 9, 10]);
	});
});
