import type { ReactNode } from 'react';

// Minimal markdown-to-React renderer for untrusted SKILL.md content. Emits
// only React elements (never raw HTML), so input markup and scripts render as
// inert text. Supports headings, paragraphs, lists, fenced and inline code,
// bold, italic, and http(s) links; everything else stays plain text.

const HEADING_CLASS: Record<number, string> = {
	1: 'mt-6 mb-3 text-[21px] font-[640] tracking-[-0.01em] first:mt-0',
	2: 'mt-5 mb-2 text-[17px] font-semibold',
	3: 'mt-4 mb-2 text-[15px] font-semibold',
	4: 'mt-4 mb-1 text-[13.5px] font-semibold',
	5: 'mt-3 mb-1 text-[13px] font-semibold',
	6: 'mt-3 mb-1 text-[12.5px] font-semibold text-muted',
};

const INLINE_TOKEN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function renderInline(text: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let last = 0;
	let key = 0;
	for (const match of text.matchAll(INLINE_TOKEN)) {
		const token = match[0];
		const start = match.index ?? 0;
		if (start > last) nodes.push(text.slice(last, start));
		if (token.startsWith('`')) {
			nodes.push(
				<code key={key++} className="rounded-[4px] bg-bg-well px-[5px] py-px font-mono text-[0.92em]">
					{token.slice(1, -1)}
				</code>,
			);
		} else if (token.startsWith('**')) {
			nodes.push(
				<strong key={key++} className="font-semibold text-text">
					{token.slice(2, -2)}
				</strong>,
			);
		} else if (token.startsWith('*')) {
			nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
		} else {
			const link = token.match(LINK);
			if (link && /^https?:\/\//i.test(link[2])) {
				nodes.push(
					<a
						key={key++}
						href={link[2]}
						target="_blank"
						rel="noreferrer noopener"
						className="text-accent hover:underline"
					>
						{link[1]}
					</a>,
				);
			} else {
				// Non-http(s) scheme: neutralize to the visible text only.
				nodes.push(link ? link[1] : token);
			}
		}
		last = start + token.length;
	}
	if (last < text.length) nodes.push(text.slice(last));
	return nodes;
}

const BLOCK_START = /^(#{1,6}\s|```|[-*]\s|\d+\.\s)/;

export function renderMarkdown(md: string): ReactNode[] {
	const lines = md.replace(/\r\n/g, '\n').split('\n');
	const blocks: ReactNode[] = [];
	let i = 0;
	let key = 0;

	while (i < lines.length) {
		const line = lines[i];
		if (line.trim() === '') {
			i++;
			continue;
		}

		if (line.startsWith('```')) {
			const buffer: string[] = [];
			i++;
			while (i < lines.length && !lines[i].startsWith('```')) {
				buffer.push(lines[i]);
				i++;
			}
			i++; // closing fence (or end of input)
			blocks.push(
				<pre
					key={key++}
					className="my-3 overflow-x-auto rounded-sm border border-border bg-bg-well px-[13px] py-[10px] font-mono text-[12.5px] leading-[1.6]"
				>
					<code>{buffer.join('\n')}</code>
				</pre>,
			);
			continue;
		}

		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			const level = heading[1].length;
			const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
			blocks.push(
				<Tag key={key++} className={HEADING_CLASS[level]}>
					{renderInline(heading[2])}
				</Tag>,
			);
			i++;
			continue;
		}

		const bullet = /^[-*]\s+/.test(line);
		const numbered = /^\d+\.\s+/.test(line);
		if (bullet || numbered) {
			const items: string[] = [];
			const marker = bullet ? /^[-*]\s+/ : /^\d+\.\s+/;
			while (i < lines.length && marker.test(lines[i])) {
				items.push(lines[i].replace(marker, ''));
				i++;
			}
			const inner = items.map((item, n) => (
				<li key={n} className="my-[3px]">
					{renderInline(item)}
				</li>
			));
			blocks.push(
				bullet ? (
					<ul key={key++} className="my-3 list-disc pl-6 text-[13.5px] text-muted">
						{inner}
					</ul>
				) : (
					<ol key={key++} className="my-3 list-decimal pl-6 text-[13.5px] text-muted">
						{inner}
					</ol>
				),
			);
			continue;
		}

		const buffer = [line];
		i++;
		while (i < lines.length && lines[i].trim() !== '' && !BLOCK_START.test(lines[i])) {
			buffer.push(lines[i]);
			i++;
		}
		blocks.push(
			<p key={key++} className="my-3 text-[13.5px] leading-[1.65] text-muted">
				{renderInline(buffer.join(' '))}
			</p>,
		);
	}

	return blocks;
}
