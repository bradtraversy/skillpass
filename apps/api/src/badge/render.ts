import type { RiskLevel, ValidationStatus } from 'skill-schema';

export interface BadgeInput {
	validationStatus: ValidationStatus;
	riskLevel: RiskLevel;
}

// The shields.io flat palette, so the badge sits naturally beside other README badges.
const GREEN = '#4c1';
const YELLOW = '#dfb317';
const ORANGE = '#fe7d37';
const RED = '#e05d44';
const LABEL_FILL = '#555';

export const STATUS_FILL: Record<ValidationStatus, string> = { passed: GREEN, warning: YELLOW, failed: RED };
export const RISK_FILL: Record<RiskLevel, string> = { low: GREEN, medium: YELLOW, high: ORANGE, critical: RED };

const LABEL = 'skillpass';
const HEIGHT = 20;
const PAD = 10;

// Verdana 11px, near enough: narrow and wide glyphs get their own widths and
// textLength on each run absorbs the rest.
export function textWidth(text: string): number {
	let width = 0;
	for (const ch of text) {
		if ('ijl'.includes(ch)) width += 3.1;
		else if ('ftr'.includes(ch)) width += 4.3;
		else if ('mw'.includes(ch)) width += 9.8;
		else if (ch === ' ') width += 3.9;
		else width += 6.5;
	}
	return Math.round(width);
}

interface Segment {
	text: string;
	fill: string;
}

// Only fixed vocabulary reaches the SVG: the label and two enum values. Any
// skill-derived string added later must be XML-escaped first.
export function renderBadge({ validationStatus, riskLevel }: BadgeInput): string {
	const segments: Segment[] = [
		{ text: LABEL, fill: LABEL_FILL },
		{ text: validationStatus, fill: STATUS_FILL[validationStatus] },
		{ text: `${riskLevel} risk`, fill: RISK_FILL[riskLevel] },
	];
	const widths = segments.map((segment) => textWidth(segment.text) + PAD);
	const total = widths.reduce((sum, width) => sum + width, 0);
	const title = `${LABEL}: ${validationStatus}, ${riskLevel} risk`;

	const rects: string[] = [];
	const texts: string[] = [];
	let x = 0;
	segments.forEach((segment, i) => {
		const width = widths[i];
		rects.push(`<rect x="${x}" width="${width}" height="${HEIGHT}" fill="${segment.fill}"/>`);
		// Text is laid out at 10x and scaled by .1 for sub-pixel placement.
		const cx = (x + width / 2) * 10;
		const length = (width - PAD) * 10;
		texts.push(
			`<text aria-hidden="true" x="${cx}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${length}">${segment.text}</text>`,
			`<text x="${cx}" y="140" transform="scale(.1)" textLength="${length}">${segment.text}</text>`,
		);
		x += width;
	});

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${HEIGHT}" role="img" aria-label="${title}">`,
		`<title>${title}</title>`,
		'<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>',
		`<clipPath id="r"><rect width="${total}" height="${HEIGHT}" rx="3" fill="#fff"/></clipPath>`,
		`<g clip-path="url(#r)">${rects.join('')}<rect width="${total}" height="${HEIGHT}" fill="url(#s)"/></g>`,
		`<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">${texts.join('')}</g>`,
		'</svg>',
	].join('');
}
