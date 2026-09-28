import { RISK_LEVELS, VALIDATION_STATUSES } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { RISK_FILL, STATUS_FILL, renderBadge, textWidth } from './render';

const rects = (svg: string) =>
	[...svg.matchAll(/<rect x="(\d+)" width="(\d+)" height="20" fill="(#[0-9a-f]+)"\/>/g)].map((m) => ({
		x: Number(m[1]),
		width: Number(m[2]),
		fill: m[3],
	}));

const visibleText = (svg: string) =>
	[...svg.matchAll(/<text x="\d+" y="140" transform="scale\(\.1\)" textLength="(\d+)">([^<]+)<\/text>/g)].map((m) => ({
		length: Number(m[1]),
		text: m[2],
	}));

const svgWidth = (svg: string) => Number(/^<svg [^>]*\swidth="(\d+)"/.exec(svg)?.[1]);

describe('renderBadge', () => {
	const svg = renderBadge({ validationStatus: 'passed', riskLevel: 'low' });

	it('renders one accessible svg named after its verdict', () => {
		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
		expect(svg.endsWith('</svg>')).toBe(true);
		expect(svg).toContain('role="img"');
		expect(svg).toContain('aria-label="skillpass: passed, low risk"');
		expect(svg).toContain('<title>skillpass: passed, low risk</title>');
	});

	it('renders the label, status, and risk as three fitted text runs', () => {
		const runs = visibleText(svg);
		expect(runs.map((run) => run.text)).toEqual(['skillpass', 'passed', 'low risk']);
		for (const run of runs) expect(run.length).toBeGreaterThan(0);
	});

	it('sizes the badge to its three segments laid end to end', () => {
		const segments = rects(svg);
		expect(segments).toHaveLength(3);
		expect(segments[0].x).toBe(0);
		expect(segments[1].x).toBe(segments[0].width);
		expect(segments[2].x).toBe(segments[0].width + segments[1].width);
		expect(svgWidth(svg)).toBe(segments[0].width + segments[1].width + segments[2].width);
	});

	it.each(VALIDATION_STATUSES)('colors the status segment for %s', (status) => {
		const out = renderBadge({ validationStatus: status, riskLevel: 'low' });
		expect(rects(out)[1].fill).toBe(STATUS_FILL[status]);
		expect(visibleText(out)[1].text).toBe(status);
	});

	it.each(RISK_LEVELS)('colors the risk segment for %s', (risk) => {
		const out = renderBadge({ validationStatus: 'passed', riskLevel: risk });
		expect(rects(out)[2].fill).toBe(RISK_FILL[risk]);
		expect(visibleText(out)[2].text).toBe(`${risk} risk`);
		expect(out).toContain(`aria-label="skillpass: passed, ${risk} risk"`);
	});

	it('uses the shields palette: green, yellow, orange, red', () => {
		expect(STATUS_FILL).toEqual({ passed: '#4c1', warning: '#dfb317', failed: '#e05d44' });
		expect(RISK_FILL).toEqual({ low: '#4c1', medium: '#dfb317', high: '#fe7d37', critical: '#e05d44' });
		expect(rects(svg)[0].fill).toBe('#555');
	});

	it('grows with longer text', () => {
		const critical = renderBadge({ validationStatus: 'passed', riskLevel: 'critical' });
		expect(svgWidth(critical)).toBeGreaterThan(svgWidth(svg));
	});
});

describe('textWidth', () => {
	it('treats narrow and wide glyphs differently and rounds to whole pixels', () => {
		expect(textWidth('ill')).toBeLessThan(textWidth('www'));
		expect(textWidth('low risk')).toBeGreaterThan(textWidth('low'));
		expect(Number.isInteger(textWidth('skillpass'))).toBe(true);
	});
});
