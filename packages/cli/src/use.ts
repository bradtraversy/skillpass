import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadVerified, writeTree } from './add';
import { fetchPreflight, resolveApiUrl } from './api';
import { confirmRisk } from './install';
import { renderPreflightReport } from './render';
import { isRepoRef } from './repo';
import type { CommandResult } from './scan';
import type { Styler } from './style';

export interface UseOptions {
	yes?: boolean;
	apiUrl?: string;
	fetchImpl?: typeof fetch;
	confirmImpl?: (question: string) => Promise<boolean>;
	// Everything except the prompt: the report, notes, and errors. stdout must
	// carry only the prompt so `$(skillpass use ...)` and pipes stay clean.
	emit?: (text: string) => void;
	tmpRoot?: string;
	style?: Styler;
}

export interface PromptInput {
	name: string;
	slug: string;
	version: string;
	dir: string;
	skillMd: string;
}

export function buildPrompt({ name, slug, version, dir, skillMd }: PromptInput): string {
	return [
		`Use the "${name}" agent skill (${slug}@${version}, validated by SkillPass) for this task.`,
		`Its files are in ${dir}; when the instructions below refer to other files, read them from that folder.`,
		'',
		skillMd.trimEnd(),
		'',
	].join('\n');
}

// Exit codes follow the CLI contract: 0 prompt printed, 1 blocked by
// validation, 2 for everything else that stops it. Nothing is written on a stop.
export async function runUse(ref: string, opts: UseOptions = {}): Promise<CommandResult> {
	const emit = opts.emit ?? ((text: string) => console.error(text));
	const say = (...next: string[]): void => {
		if (next.length > 0) emit(next.join('\n'));
	};
	const stop = (exitCode: number): CommandResult => ({ lines: [], exitCode, streamed: true });

	if (isRepoRef(ref)) {
		say(`error: use runs a directory skill; for a repo, install it with skillpass add ${ref}`);
		return stop(2);
	}
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	const apiUrl = resolveApiUrl(opts.apiUrl);
	const fetched = await fetchPreflight(fetchImpl, apiUrl, ref);
	if (!fetched.ok) {
		say(...fetched.result.lines);
		return stop(fetched.result.exitCode);
	}
	const { slug, detail, preflight } = fetched;
	say(...renderPreflightReport(detail, preflight, opts.style));

	const members = detail.packMembers ?? [];
	if (members.length > 0) {
		say(
			'',
			`error: ${slug} is a pack of ${members.length} skills; use runs one skill. Install the pack with skillpass add ${slug}`,
		);
		return stop(2);
	}
	if (preflight.blocked) {
		return stop(1);
	}
	const label = `${slug}@${preflight.version}`;
	const question = `Use ${label} (${preflight.riskLevel} risk)? [y/N] `;
	const confirmed = await confirmRisk(preflight, opts, question, 'Cancelled; nothing was run.', say);
	if (!confirmed) {
		return stop(2);
	}

	const download = await downloadVerified(fetchImpl, apiUrl, slug, preflight.version, preflight.sourceHash);
	if (!download.ok) {
		say('', `error: ${download.message}`);
		return stop(2);
	}
	const skillMd = download.files.find((file) => file.path === 'SKILL.md');
	if (!skillMd) {
		say('', `error: ${label} has no SKILL.md at its root; install it with skillpass add ${slug}`);
		return stop(2);
	}

	const dir = join(mkdtempSync(join(opts.tmpRoot ?? tmpdir(), 'skillpass-use-')), slug);
	writeTree(download.files, dir);
	say('', 'Source hash verified against the Skill Passport.', `Unpacked to ${dir}`);
	return {
		lines: [buildPrompt({ name: detail.name, slug, version: preflight.version, dir, skillMd: skillMd.content })],
		exitCode: 0,
	};
}
