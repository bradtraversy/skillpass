import { pageItems } from '../../lib/paginate';

const EDGE_BTN =
	'rounded-sm border border-border-2 px-[10px] py-[6px] text-muted hover:bg-hover hover:text-text disabled:pointer-events-none disabled:opacity-40';

export default function Pagination({
	page,
	pageCount,
	onPage,
}: {
	page: number;
	pageCount: number;
	onPage: (page: number) => void;
}) {
	if (pageCount <= 1) return null;
	return (
		<nav
			aria-label="Pagination"
			className="mt-7 mb-16 flex items-center justify-center gap-[6px] font-mono text-[12.5px]"
		>
			<button type="button" onClick={() => onPage(page - 1)} disabled={page === 1} className={EDGE_BTN}>
				Prev
			</button>
			{pageItems(page, pageCount).map((item, i) =>
				item === 'gap' ? (
					<span key={`gap-${i}`} className="px-[4px] text-faint">
						...
					</span>
				) : (
					<button
						key={item}
						type="button"
						onClick={() => onPage(item)}
						aria-current={item === page ? 'page' : undefined}
						className={`min-w-[34px] rounded-sm border px-[9px] py-[6px] ${
							item === page
								? 'border-accent-line bg-accent-soft font-medium text-accent'
								: 'border-border-2 text-muted hover:bg-hover hover:text-text'
						}`}
					>
						{item}
					</button>
				),
			)}
			<button
				type="button"
				onClick={() => onPage(page + 1)}
				disabled={page === pageCount}
				className={EDGE_BTN}
			>
				Next
			</button>
		</nav>
	);
}
