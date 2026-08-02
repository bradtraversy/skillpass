import { describe, expect, it } from 'vitest';
import { ANSI, PLAIN, styler } from './style';

describe('styler', () => {
	it('wraps text in ANSI codes', () => {
		expect(ANSI.bold('x')).toBe('\x1b[1mx\x1b[22m');
		expect(ANSI.green('x')).toBe('\x1b[32mx\x1b[39m');
		expect(ANSI.red('x')).toBe('\x1b[31mx\x1b[39m');
	});

	it('is plain when stdout is not a TTY', () => {
		expect(styler(false, {})).toBe(PLAIN);
		expect(PLAIN.bold('x')).toBe('x');
	});

	it('honors NO_COLOR even on a TTY', () => {
		expect(styler(true, { NO_COLOR: '1' })).toBe(PLAIN);
		expect(styler(true, {})).toBe(ANSI);
	});
});
