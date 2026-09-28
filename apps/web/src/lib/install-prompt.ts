import { SITE_URL } from './site';

// Mirrors the CLI's install registry; keep in step with packages/cli/src/targets.ts.
export const PROMPT_TOOLS = [
	'claude-code',
	'codex',
	'cursor',
	'windsurf',
	'github-copilot',
	'gemini-cli',
	'cline',
	'opencode',
] as const;

export interface InstallPromptInput {
	slug: string;
	version: string;
	pinned: boolean;
}

// The CLI tab and the Prompt tab must name the same thing: the bare slug on
// the latest page, slug@version on a version permalink.
export function installRef(slug: string, version: string, pinned: boolean): string {
	return pinned ? `${slug}@${version}` : slug;
}

export function installPrompt({ slug, version, pinned }: InstallPromptInput): string {
	const ref = installRef(slug, version, pinned);
	const passport = `${SITE_URL}/skills/${encodeURIComponent(slug)}${pinned ? `/${encodeURIComponent(version)}` : ''}`;
	const which = pinned ? `version ${version}` : 'latest version';
	return [
		`Install the SkillPass skill "${slug}" (${which}) with the skillpass CLI, then report what you did.`,
		'',
		`1. From the project root run: npx skillpass@latest add ${ref} --target <tool>`,
		`   where <tool> is the agent you are: ${PROMPT_TOOLS.join(', ')}. Add --global for the user-level skills folder instead of the project one.`,
		'2. The CLI prints a pre-flight report before writing anything: validation status, risk level, permissions, and findings. If it stops because the risk is medium or higher, show me the report and wait. Only rerun with --yes after I approve.',
		'3. When it finishes, tell me the installed path and summarize what the skill does in two sentences.',
		'',
		`Passport: ${passport}`,
	].join('\n');
}
