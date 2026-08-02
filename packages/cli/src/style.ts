export interface Styler {
	bold: (text: string) => string;
	dim: (text: string) => string;
	green: (text: string) => string;
	yellow: (text: string) => string;
	red: (text: string) => string;
	cyan: (text: string) => string;
}

const wrap =
	(open: number, close: number) =>
	(text: string): string =>
		`\x1b[${open}m${text}\x1b[${close}m`;

export const ANSI: Styler = {
	bold: wrap(1, 22),
	dim: wrap(2, 22),
	green: wrap(32, 39),
	yellow: wrap(33, 39),
	red: wrap(31, 39),
	cyan: wrap(36, 39),
};

const identity = (text: string): string => text;

export const PLAIN: Styler = {
	bold: identity,
	dim: identity,
	green: identity,
	yellow: identity,
	red: identity,
	cyan: identity,
};

// Colors belong to interactive terminals only; pipes get plain text and the
// NO_COLOR convention (https://no-color.org) is honored.
export function styler(isTTY: boolean, env: Record<string, string | undefined> = process.env): Styler {
	return isTTY && !env.NO_COLOR ? ANSI : PLAIN;
}
