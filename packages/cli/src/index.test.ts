import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main, parseCliArgs, run, USAGE, VERSION } from './index';

describe('parseCliArgs', () => {
	it('splits command, positionals, and flags', () => {
		expect(parseCliArgs(['scan', './pkg', '--json'])).toEqual({
			command: 'scan',
			positional: ['./pkg'],
			json: true,
			help: false,
			version: false,
			yes: false,
			global: false,
			packs: false,
			ai: false,
			seen: ['--json'],
		});
	});

	it('handles empty argv', () => {
		expect(parseCliArgs([])).toEqual({
			command: undefined,
			positional: [],
			json: false,
			help: false,
			version: false,
			yes: false,
			global: false,
			packs: false,
			ai: false,
			seen: [],
		});
	});

	it('parses --dir with a value and --yes', () => {
		expect(parseCliArgs(['add', 'smoke-clean', '--dir', './here', '--yes'])).toEqual({
			command: 'add',
			positional: ['smoke-clean'],
			json: false,
			help: false,
			version: false,
			yes: true,
			global: false,
			packs: false,
			ai: false,
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
			version: false,
			yes: false,
			global: true,
			packs: false,
			ai: false,
			targets: ['claude-code'],
			seen: ['--target', '--global'],
		});
	});

	it('collects repeated --target values in order without duplicates', () => {
		const parsed = parseCliArgs([
			'add',
			'x',
			'--target',
			'claude-code',
			'--target',
			'cursor',
			'--target',
			'claude-code',
		]);
		expect(parsed.targets).toEqual(['claude-code', 'cursor']);
		expect(parsed.seen).toEqual(['--target', '--target', '--target']);
	});

	it('lets only add take more than one --target', async () => {
		const result = await run(['remove', 'x', '--target', 'claude-code', '--target', 'cursor']);
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toBe('error: remove takes one --target');
	});

	it('marks an unknown flag invalid instead of swallowing it', () => {
		const parsed = parseCliArgs(['add', 'smoke-clean', '--tarrget', 'claude-code']);
		expect(parsed.invalid).toBe('unknown flag "--tarrget"');
	});

	it('marks a flag with a missing value invalid', () => {
		expect(parseCliArgs(['add', 'smoke-clean', '--target']).invalid).toBe('--target needs a value');
		expect(parseCliArgs(['add', 'smoke-clean', '--dir', '--yes']).invalid).toBe('--dir needs a value');
	});

	it('parses --category with a value and --packs', () => {
		const parsed = parseCliArgs(['search', 'commit', '--category', 'agent-workflow', '--packs']);
		expect(parsed.category).toBe('agent-workflow');
		expect(parsed.packs).toBe(true);
		expect(parsed.positional).toEqual(['commit']);
		expect(parsed.seen).toEqual(['--category', '--packs']);
	});

	it('parses --ai for search and rejects it elsewhere', async () => {
		const parsed = parseCliArgs(['search', 'turn a video into an article', '--ai']);
		expect(parsed.ai).toBe(true);
		expect(parsed.seen).toEqual(['--ai']);
		const result = await run(['add', 'x', '--ai']);
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toBe('error: add does not take --ai');
	});

	it('marks --category with a missing value invalid', () => {
		expect(parseCliArgs(['search', '--category']).invalid).toBe('--category needs a value');
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

		const addPacks = await run(['add', 'smoke-clean', '--packs']);
		expect(addPacks.exitCode).toBe(2);
		expect(addPacks.lines[0]).toBe('error: add does not take --packs');

		const searchYes = await run(['search', 'x', '--yes']);
		expect(searchYes.exitCode).toBe(2);
		expect(searchYes.lines[0]).toBe('error: search does not take --yes');

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

	it('prints the package version for --version and exits 0', async () => {
		const result = await run(['--version']);
		expect(result.exitCode).toBe(0);
		const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
			version: string;
		};
		expect(result.lines).toEqual([pkg.version]);
		expect(VERSION).toBe(pkg.version);
	});

	it('rejects positional arguments to list', async () => {
		const result = await run(['list', 'extra']);
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toBe('error: list takes no arguments');
	});
});

describe('main', () => {
	afterEach(() => {
		process.exitCode = undefined;
		vi.restoreAllMocks();
	});

	it('sends an error result to stderr and exits 2', async () => {
		const out = vi.spyOn(console, 'log').mockImplementation(() => {});
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		await main(['frobnicate']);
		expect(process.exitCode).toBe(2);
		expect(out).not.toHaveBeenCalled();
		expect(String(err.mock.calls[0]?.[0])).toContain('unknown command');
	});

	it('keeps a successful result on stdout', async () => {
		const out = vi.spyOn(console, 'log').mockImplementation(() => {});
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		await main(['--help']);
		expect(process.exitCode).toBe(0);
		expect(err).not.toHaveBeenCalled();
		expect(String(out.mock.calls[0]?.[0])).toBe(USAGE);
	});

	it('turns a crash into exit 2 on stderr, never the failed-scan code', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		await main(['scan', 'x'], async () => {
			throw new Error('boom');
		});
		expect(process.exitCode).toBe(2);
		expect(err).toHaveBeenCalledWith('error: boom');
	});
});
