import { createInterface } from 'node:readline/promises';
import { runAdd } from './add';
import { runReport } from './report';
import type { CommandResult } from './scan';
import { runScan } from './scan';

export const USAGE = [
	'aiskills - validate AI agent skills locally and inspect hosted passports',
	'',
	'Usage:',
	'  aiskills scan <path> [--json]              run the validator on a local skill package',
	'  aiskills report <slug>[@version] [--json]  fetch the hosted passport pre-flight',
	'  aiskills add <slug>[@version] [--target <tool> [--global] | --dir <path>] [--yes]',
	'                                             install a skill through the pre-flight gate',
	'',
	'Flags:',
	'  --json    print machine-readable JSON instead of the readable report',
	'  --target  install into a tool\'s skills folder: claude-code (.claude/skills),',
	'            codex (.agents/skills)',
	'  --global  with --target claude-code, install to ~/.claude/skills instead',
	'  --dir     install target directory (default ./<slug>)',
	'  --yes     skip the confirmation prompt for medium+ risk skills',
	'  --help    show this message',
	'',
	'The report and add commands read the API base URL from AISKILLS_API.',
	'Exit codes: 0 ok/warning, 1 failed or blocked, 2 usage/load/network errors.',
].join('\n');

export interface ParsedArgs {
	command?: string;
	positional: string[];
	json: boolean;
	help: boolean;
	yes: boolean;
	global: boolean;
	dir?: string;
	target?: string;
}

export function parseCliArgs(argv: string[]): ParsedArgs {
	const parsed: ParsedArgs = { positional: [], json: false, help: false, yes: false, global: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--json') {
			parsed.json = true;
		} else if (arg === '--yes' || arg === '-y') {
			parsed.yes = true;
		} else if (arg === '--global') {
			parsed.global = true;
		} else if (arg === '--dir') {
			parsed.dir = argv[++i];
		} else if (arg === '--target') {
			parsed.target = argv[++i];
		} else if (arg === '--help' || arg === '-h') {
			parsed.help = true;
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
	if (args.help || args.command === undefined) {
		return { lines: [USAGE], exitCode: args.help ? 0 : 2 };
	}
	if (args.command === 'scan') {
		const [path] = args.positional;
		if (!path) {
			return { lines: ['error: scan needs a path to a skill package', '', USAGE], exitCode: 2 };
		}
		return runScan(path, { json: args.json });
	}
	if (args.command === 'report') {
		const [ref] = args.positional;
		if (!ref) {
			return { lines: ['error: report needs a skill slug', '', USAGE], exitCode: 2 };
		}
		return runReport(ref, { json: args.json });
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
