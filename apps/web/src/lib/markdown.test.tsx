import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

function html(md: string): string {
	return renderToStaticMarkup(<>{renderMarkdown(md)}</>);
}

describe('renderMarkdown', () => {
	it('renders headings by level', () => {
		const out = html('# Title\n\n## Section\n\n###### Tiny');
		expect(out).toContain('<h1');
		expect(out).toContain('Title');
		expect(out).toContain('<h2');
		expect(out).toContain('<h6');
	});

	it('renders paragraphs, joining wrapped lines', () => {
		const out = html('First line\nstill first paragraph.\n\nSecond paragraph.');
		expect(out.match(/<p/g)).toHaveLength(2);
		expect(out).toContain('First line still first paragraph.');
	});

	it('renders bullet and numbered lists', () => {
		const out = html('- one\n- two\n\n1. first\n2. second');
		expect(out).toContain('<ul');
		expect(out.match(/<li/g)).toHaveLength(4);
		expect(out).toContain('<ol');
	});

	it('renders fenced code blocks verbatim, ignoring markdown inside', () => {
		const out = html('```bash\nrm -rf **bold**\n```');
		expect(out).toContain('<pre');
		expect(out).toContain('rm -rf **bold**');
		expect(out).not.toContain('<strong>bold');
	});

	it('renders inline code, bold, and italic', () => {
		const out = html('Use `skillpass scan` for a **local** *check*.');
		expect(out).toContain('<code');
		expect(out).toContain('skillpass scan');
		expect(out).toContain('<strong');
		expect(out).toContain('<em>check</em>');
	});

	it('links http(s) URLs with a safe rel', () => {
		const out = html('[docs](https://example.com/docs)');
		expect(out).toContain('href="https://example.com/docs"');
		expect(out).toContain('rel="noreferrer noopener"');
	});

	it('neutralizes non-http(s) link schemes to plain text', () => {
		const out = html('[click](javascript:alert(1))');
		expect(out).not.toContain('<a');
		expect(out).not.toContain('javascript:');
		expect(out).toContain('click');
	});

	it('renders raw HTML and script tags as inert text', () => {
		const out = html('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
		expect(out).not.toContain('<script>');
		expect(out).not.toContain('<img');
		expect(out).toContain('&lt;script&gt;');
	});

	it('survives an unterminated code fence', () => {
		const out = html('```\nno closing fence');
		expect(out).toContain('no closing fence');
	});
});
