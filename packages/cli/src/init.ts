import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { PERMISSIONS, SLUG_RE, type PermissionKey } from 'skill-schema';
import { runScan, type CommandResult } from './scan';
import { PLAIN, type Styler } from './style';

export const PLACEHOLDER_DESCRIPTION = 'Describe what this skill does and when an agent should use it.';
export const SUBMIT_URL = 'https://skillpass.dev/submit';

export interface SkillDraft {
	name: string;
	description: string;
	permissions: PermissionKey[];
}

export interface InitOptions {
	cwd?: string;
	// Present only on a TTY; without it init never prompts.
	promptImpl?: (question: string) => Promise<string>;
	style?: Styler;
}

const titleFor = (name: string) =>
	name
		.split('-')
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(' ');

// A plain YAML scalar breaks on colons, comments, quotes, or values like "yes";
// anything risky goes out as a folded block, which the validator's reader handles too.
export function yamlDescription(text: string): string {
	const plainSafe =
		/^[A-Za-z]/.test(text) && !/[:#'"\\]/.test(text) && !/^(?:null|true|false|yes|no|on|off)$/i.test(text);
	return plainSafe ? `description: ${text}` : `description: >-\n  ${text}`;
}

// The placeholder prose must not match any permission signal, so a fresh
// scaffold detects nothing.
export function renderSkillMd(draft: SkillDraft): string {
	return [
		'---',
		`name: ${draft.name}`,
		yamlDescription(draft.description),
		'---',
		'',
		`# ${titleFor(draft.name)}`,
		'',
		'## When to use',
		'',
		'Use this skill when the user asks for help with the task it covers. Replace this line with the exact situations that should trigger it.',
		'',
		'## Instructions',
		'',
		'1. Replace these steps with what the agent should do, in order.',
		'2. Keep each step short and concrete.',
		'',
	].join('\n');
}

export function renderManifest(draft: SkillDraft): string {
	const manifest = {
		schemaVersion: '0.1',
		name: draft.name,
		description: draft.description,
		version: '0.1.0',
		targets: ['claude-code', 'codex'],
		permissions: draft.permissions,
	};
	return `${JSON.stringify(manifest, null, 2)}\n`;
}

export type PermissionAnswer = { ok: true; keys: PermissionKey[] } | { ok: false; token: string };

// Numbers refer to the printed list (1-based); keys work too. Returns keys in
// taxonomy order with duplicates dropped.
export function parsePermissionAnswer(answer: string): PermissionAnswer {
	const chosen = new Set<PermissionKey>();
	for (const token of answer.split(/[\s,]+/).filter(Boolean)) {
		const index = /^\d+$/.test(token) ? Number(token) - 1 : -1;
		const match = PERMISSIONS[index] ?? PERMISSIONS.find((permission) => permission.key === token);
		if (!match) return { ok: false, token };
		chosen.add(match.key);
	}
	return { ok: true, keys: PERMISSIONS.filter((permission) => chosen.has(permission.key)).map((p) => p.key) };
}

const PERMISSION_LIST = PERMISSIONS.map(
	(permission, i) => `  ${String(i + 1).padStart(2)}. ${permission.key.padEnd(26)} ${permission.label}`,
).join('\n');

async function askName(ask: (question: string) => Promise<string>): Promise<string | undefined> {
	let question = 'Skill name (lowercase letters, digits, hyphens; e.g. my-skill): ';
	for (;;) {
		const answer = (await ask(question)).trim();
		if (answer === '') return undefined;
		if (SLUG_RE.test(answer)) return answer;
		question = `"${answer}" is not a valid name. Use lowercase letters, digits, and single hyphens: `;
	}
}

async function askPermissions(ask: (question: string) => Promise<string>): Promise<PermissionKey[]> {
	let question = `Permissions the skill needs:\n${PERMISSION_LIST}\nNumbers or keys, comma-separated (Enter for none): `;
	for (;;) {
		const parsed = parsePermissionAnswer(await ask(question));
		if (parsed.ok) return parsed.keys;
		question = `"${parsed.token}" is not on the list. Numbers or keys (Enter for none): `;
	}
}

// Exit codes follow the CLI contract: the scan's 0/1, or 2 for a usage error,
// an existing target, or a cancelled prompt. Nothing is written on a 2.
export async function runInit(nameArg: string | undefined, opts: InitOptions = {}): Promise<CommandResult> {
	const ask = opts.promptImpl;
	if (nameArg !== undefined && !SLUG_RE.test(nameArg)) {
		return {
			lines: [`error: "${nameArg}" is not a valid skill name; use lowercase letters, digits, and single hyphens`],
			exitCode: 2,
		};
	}
	if (nameArg === undefined && !ask) {
		return { lines: ['error: init needs a skill name outside a terminal: skillpass init <name>'], exitCode: 2 };
	}
	const name = nameArg ?? (ask ? await askName(ask) : undefined);
	if (name === undefined) {
		return { lines: ['init cancelled; nothing was written'], exitCode: 2 };
	}
	const dir = resolve(opts.cwd ?? process.cwd(), name);
	if (existsSync(dir)) {
		return { lines: [`error: ${name} already exists here; nothing was written`], exitCode: 2 };
	}

	const description =
		(ask ? (await ask('Description (what it does and when to use it): ')).trim() : '') || PLACEHOLDER_DESCRIPTION;
	const permissions = ask ? await askPermissions(ask) : [];
	const draft: SkillDraft = { name, description, permissions };

	mkdirSync(dir);
	try {
		writeFileSync(join(dir, 'SKILL.md'), renderSkillMd(draft));
		writeFileSync(join(dir, 'skill.json'), renderManifest(draft));
	} catch (err) {
		// The folder is new (existence was refused and mkdirSync is not recursive),
		// so removing it only undoes this run and lets a retry start clean.
		rmSync(dir, { recursive: true, force: true });
		throw err;
	}

	const st = opts.style ?? PLAIN;
	const scan = await runScan(relative(process.cwd(), dir), { style: opts.style });
	return {
		lines: [
			`${st.green('Created')} ${name}/SKILL.md`,
			`${st.green('Created')} ${name}/skill.json`,
			'',
			...scan.lines,
			'',
			`Next: write the instructions in ${name}/SKILL.md, check it with \`skillpass scan ${name}\`, then submit it at ${SUBMIT_URL}`,
		],
		exitCode: scan.exitCode,
	};
}
