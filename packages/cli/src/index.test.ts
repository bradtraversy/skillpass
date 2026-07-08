import { describe, expect, it } from 'vitest';
import { parseCliArgs, run, USAGE } from './index';

describe('parseCliArgs', () => {
	it('splits command, positionals, and flags', () => {
		expect(parseCliArgs(['scan', './pkg', '--json'])).toEqual({
			command: 'scan',
			positional: ['./pkg'],
			json: true,
			help: false,
			yes: false,
			global: false,
		});
	});

	it('handles empty argv', () => {
		expect(parseCliArgs([])).toEqual({
			command: undefined,
			positional: [],
			json: false,
			help: false,
			yes: false,
			global: false,
		});
	});

	it('parses --dir with a value and --yes', () => {
		expect(parseCliArgs(['add', 'smoke-clean', '--dir', './here', '--yes'])).toEqual({
			command: 'add',
			positional: ['smoke-clean'],
			json: false,
			help: false,
			yes: true,
			global: false,
			dir: './here',
		});
	});

	it('parses --target with a value and --global', () => {
		expect(parseCliArgs(['add', 'smoke-clean', '--target', 'claude-code', '--global'])).toEqual({
			command: 'add',
			positional: ['smoke-clean'],
			json: false,
			help: false,
			yes: false,
			global: true,
			target: 'claude-code',
		});
	});
});

describe('run', () => {
	it('prints usage and exits 2 with no arguments', async () => {
		const result = await run([]);
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toBe(USAGE);
	});

	it('prints usage and exits 0 with --help', async () => {
		const result = await run(['--help']);
		expect(result.exitCode).toBe(0);
	});

	it('rejects an unknown command with exit 2', async () => {
		const result = await run(['frobnicate']);
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('unknown command');
	});

	it('requires a path for scan', async () => {
		const result = await run(['scan']);
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('needs a path');
	});

	it('requires a slug for add', async () => {
		const result = await run(['add']);
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('needs a skill slug');
	});
});
