import { runReport } from './report';
import type { CommandResult } from './scan';
import { runScan } from './scan';

export const USAGE = [
	'aiskills - validate AI agent skills locally and inspect hosted passports',
	'',
	'Usage:',
	'  aiskills scan <path> [--json]              run the validator on a local skill package',
	'  aiskills report <slug>[@version] [--json]  fetch the hosted passport pre-flight',
	'',
	'Flags:',
	'  --json    print machine-readable JSON instead of the readable report',
	'  --help    show this message',
	'',
	'The report command reads the API base URL from AISKILLS_API.',
	'Exit codes: 0 ok/warning, 1 failed or blocked, 2 usage/load/network errors.',
].join('\n');

export interface ParsedArgs {
	command?: string;
	positional: string[];
	json: boolean;
	help: boolean;
}

export function parseCliArgs(argv: string[]): ParsedArgs {
	const parsed: ParsedArgs = { positional: [], json: false, help: false };
	for (const arg of argv) {
		if (arg === '--json') {
			parsed.json = true;
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
	return { lines: [`error: unknown command "${args.command}"`, '', USAGE], exitCode: 2 };
}

export async function main(argv: string[]): Promise<void> {
	const result = await run(argv);
	console.log(result.lines.join('\n'));
	process.exitCode = result.exitCode;
}
