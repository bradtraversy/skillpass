import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { runAdd } from './add';
import { runList } from './list';
import { runOutdated } from './outdated';
import { runRemove } from './remove';
import { runReport } from './report';
import { runSearch } from './search';
import { styler } from './style';
import { runUpdate } from './update';
import type { CommandResult } from './scan';
import { runScan } from './scan';

export const VERSION = (
	JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
		version: string;
	}
).version;

export const USAGE = [
	'skillpass - validate AI agent skills locally and inspect hosted passports',
	'',
	'Usage:',
	'  skillpass search [query] [--target <tool>] [--category <slug>] [--packs] [--json]',
	'                                             find skills in the directory',
	'  skillpass scan <path> [--json]              run the validator on a local skill package',
	'  skillpass report <slug>[@version] [--json]  fetch the hosted passport pre-flight',
	'  skillpass add <slug>[@version] [--target <tool> [--global] | --dir <path>] [--yes]',
	'                                             install a skill through the pre-flight gate',
	'  skillpass remove <slug> [--target <tool> [--global] | --dir <path>]',
	'                                             remove an installed skill',
	'  skillpass list                              show installed skills in the known areas',
	'  skillpass outdated                          compare installed skills to the directory',
	'  skillpass update <slug>[@version] [--target <tool> [--global]] [--yes]',
	'                                             update an installed skill through the gate',
	'',
	'Flags:',
	'  --json    print machine-readable JSON instead of the readable report',
	'  --target  install into a tool\'s skills folder: claude-code (.claude/skills),',
	'            codex (.agents/skills)',
	'  --global  with --target claude-code, install to ~/.claude/skills instead',
	'  --dir     install target directory (default ./<slug>)',
	'  --yes     skip the confirmation prompt for medium+ risk skills',
	'  --category  search filter: a directory category slug',
	'  --packs   search filter: multi-skill packs only',
	'  --version print the CLI version',
	'  --help    show this message',
	'',
	'The search, report, and add commands read the API base URL from SKILLPASS_API.',
	'Exit codes: 0 ok/warning, 1 failed or blocked, 2 usage/load/network errors',
	'(outdated exits 1 when updates are available).',
].join('\n');

export interface ParsedArgs {
	command?: string;
	positional: string[];
	json: boolean;
	help: boolean;
	version: boolean;
	yes: boolean;
	global: boolean;
	packs: boolean;
	dir?: string;
	target?: string;
	category?: string;
	// Canonical names of every flag encountered, for per-command validation.
	seen: string[];
	// First parse error (unknown flag, missing value); commands must not run.
	invalid?: string;
}

const COMMAND_FLAGS: Record<string, string[]> = {
	scan: ['--json'],
	report: ['--json'],
	add: ['--yes', '--target', '--dir', '--global'],
	remove: ['--target', '--dir', '--global'],
	list: [],
	outdated: [],
	update: ['--yes', '--target', '--global'],
	search: ['--target', '--category', '--packs', '--json'],
};

export function parseCliArgs(argv: string[]): ParsedArgs {
	const parsed: ParsedArgs = {
		positional: [],
		json: false,
		help: false,
		version: false,
		yes: false,
		global: false,
		packs: false,
		seen: [],
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--json') {
			parsed.json = true;
			parsed.seen.push(arg);
		} else if (arg === '--yes' || arg === '-y') {
			parsed.yes = true;
			parsed.seen.push('--yes');
		} else if (arg === '--global') {
			parsed.global = true;
			parsed.seen.push(arg);
		} else if (arg === '--packs') {
			parsed.packs = true;
			parsed.seen.push(arg);
		} else if (arg === '--dir' || arg === '--target' || arg === '--category') {
			parsed.seen.push(arg);
			const value = argv[i + 1];
			if (value === undefined || value.startsWith('-')) {
				parsed.invalid ??= `${arg} needs a value`;
			} else {
				i++;
				if (arg === '--dir') {
					parsed.dir = value;
				} else if (arg === '--target') {
					parsed.target = value;
				} else {
					parsed.category = value;
				}
			}
		} else if (arg === '--help' || arg === '-h') {
			parsed.help = true;
		} else if (arg === '--version') {
			parsed.version = true;
		} else if (arg.startsWith('-')) {
			parsed.invalid ??= `unknown flag "${arg}"`;
		} else if (parsed.command === undefined) {
			parsed.command = arg;
		} else {
			parsed.positional.push(arg);
		}
	}
	return parsed;
}

async function promptViaTty(question: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return await rl.question(question);
	} finally {
		rl.close();
	}
}

async function confirmViaTty(question: string): Promise<boolean> {
	const answer = await promptViaTty(question);
	return ['y', 'yes'].includes(answer.trim().toLowerCase());
}

export async function run(argv: string[]): Promise<CommandResult> {
	const args = parseCliArgs(argv);
	if (args.help) {
		return { lines: [USAGE], exitCode: 0 };
	}
	if (args.version) {
		return { lines: [VERSION], exitCode: 0 };
	}
	if (args.command === undefined) {
		return { lines: [USAGE], exitCode: 2 };
	}
	if (args.invalid) {
		return { lines: [`error: ${args.invalid}`, '', USAGE], exitCode: 2 };
	}
	const allowed = COMMAND_FLAGS[args.command];
	const disallowed = allowed && args.seen.find((flag) => !allowed.includes(flag));
	if (disallowed) {
		return { lines: [`error: ${args.command} does not take ${disallowed}`, '', USAGE], exitCode: 2 };
	}
	if (args.command === 'search') {
		return runSearch({
			query: args.positional.join(' '),
			target: args.target,
			category: args.category,
			packs: args.packs,
			json: args.json,
			width: process.stdout.isTTY ? process.stdout.columns : undefined,
			style: styler(Boolean(process.stdout.isTTY)),
		});
	}
	if (args.command === 'scan') {
		const [path] = args.positional;
		if (!path) {
			return { lines: ['error: scan needs a path to a skill package', '', USAGE], exitCode: 2 };
		}
		return runScan(path, { json: args.json, style: styler(Boolean(process.stdout.isTTY)) });
	}
	if (args.command === 'remove') {
		const [slug] = args.positional;
		if (!slug) {
			return { lines: ['error: remove needs a skill slug', '', USAGE], exitCode: 2 };
		}
		return runRemove(slug, { target: args.target, dir: args.dir, global: args.global });
	}
	if (args.command === 'list') {
		if (args.positional.length > 0) {
			return { lines: ['error: list takes no arguments', '', USAGE], exitCode: 2 };
		}
		return runList();
	}
	if (args.command === 'update') {
		const [ref] = args.positional;
		if (!ref) {
			return { lines: ['error: update needs a skill slug', '', USAGE], exitCode: 2 };
		}
		const tty = Boolean(process.stdin.isTTY);
		return runUpdate(ref, {
			yes: args.yes,
			target: args.target,
			global: args.global,
			style: styler(Boolean(process.stdout.isTTY)),
			confirmImpl: tty ? confirmViaTty : undefined,
			emit: (text) => console.log(text),
		});
	}
	if (args.command === 'outdated') {
		if (args.positional.length > 0) {
			return { lines: ['error: outdated takes no arguments', '', USAGE], exitCode: 2 };
		}
		return runOutdated();
	}
	if (args.command === 'report') {
		const [ref] = args.positional;
		if (!ref) {
			return { lines: ['error: report needs a skill slug', '', USAGE], exitCode: 2 };
		}
		return runReport(ref, { json: args.json, style: styler(Boolean(process.stdout.isTTY)) });
	}
	if (args.command === 'add') {
		const [ref] = args.positional;
		if (!ref) {
			return { lines: ['error: add needs a skill slug', '', USAGE], exitCode: 2 };
		}
		const tty = Boolean(process.stdin.isTTY);
		return runAdd(ref, {
			yes: args.yes,
			dir: args.dir,
			target: args.target,
			global: args.global,
			style: styler(Boolean(process.stdout.isTTY)),
			confirmImpl: tty ? confirmViaTty : undefined,
			promptImpl: tty ? promptViaTty : undefined,
			emit: (text) => console.log(text),
		});
	}
	return { lines: [`error: unknown command "${args.command}"`, '', USAGE], exitCode: 2 };
}

export async function main(argv: string[]): Promise<void> {
	const result = await run(argv);
	if (!result.streamed) {
		console.log(result.lines.join('\n'));
	}
	process.exitCode = result.exitCode;
}
