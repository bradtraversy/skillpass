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
			seen: ['--json'],
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
			seen: [],
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
			seen: ['--dir', '--yes'],
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
			seen: ['--target', '--global'],
		});
	});

	it('marks an unknown flag invalid instead of swallowing it', () => {
		const parsed = parseCliArgs(['add', 'smoke-clean', '--tarrget', 'claude-code']);
		expect(parsed.invalid).toBe('unknown flag "--tarrget"');
	});

	it('marks a flag with a missing value invalid', () => {
		expect(parseCliArgs(['add', 'smoke-clean', '--target']).invalid).toBe('--target needs a value');
		expect(parseCliArgs(['add', 'smoke-clean', '--dir', '--yes']).invalid).toBe(
			'--dir needs a value',
		);
	});

	it('keeps the first error when several flags are bad', () => {
		const parsed = parseCliArgs(['scan', '--wat', '--wut']);
		expect(parsed.invalid).toBe('unknown flag "--wat"');
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

	it('rejects a typo-d flag with exit 2 and usage', async () => {
		const result = await run(['add', 'smoke-clean', '--tarrget', 'claude-code']);
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toBe('error: unknown flag "--tarrget"');
		expect(result.lines).toContain(USAGE);
	});

	it('rejects a flag missing its value with exit 2', async () => {
		const result = await run(['scan', './pkg', '--target']);
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toBe('error: --target needs a value');
	});

	it('rejects flags a command does not take', async () => {
		const scanYes = await run(['scan', './pkg', '--yes']);
		expect(scanYes.exitCode).toBe(2);
		expect(scanYes.lines[0]).toBe('error: scan does not take --yes');

		const addJson = await run(['add', 'smoke-clean', '--json']);
		expect(addJson.exitCode).toBe(2);
		expect(addJson.lines[0]).toBe('error: add does not take --json');

		const reportGlobal = await run(['report', 'smoke-clean', '--global']);
		expect(reportGlobal.exitCode).toBe(2);
		expect(reportGlobal.lines[0]).toBe('error: report does not take --global');
	});

	it('still shows usage for --help next to other flags', async () => {
		const result = await run(['add', '--help', '--wat']);
		expect(result.exitCode).toBe(0);
		expect(result.lines[0]).toBe(USAGE);
	});
});
