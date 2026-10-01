import { INSTALL_TOOLS, type InstallTool } from './install-tools';
import { SITE_URL } from './site';

export const PROMPT_TOOLS: readonly string[] = INSTALL_TOOLS.map((tool) => tool.slug);

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

const GLOBAL_NOTE = 'Add --global for the user-level skills folder instead of the project one.';
const PREFLIGHT_STEP =
	'2. The CLI prints a pre-flight report before writing anything: validation status, risk level, permissions, and findings. If it stops because the risk is medium or higher, show me the report and wait. Only rerun with --yes after I approve.';
const REPORT_STEP =
	'3. When it finishes, tell me the installed path and summarize what the skill does in two sentences.';

function buildPrompt(opening: string, commandLines: string[], passport: string): string {
	return [opening, '', ...commandLines, PREFLIGHT_STEP, REPORT_STEP, '', `Passport: ${passport}`].join('\n');
}

export function installPrompt({ slug, version, pinned }: InstallPromptInput): string {
	const ref = installRef(slug, version, pinned);
	const passport = `${SITE_URL}/skills/${encodeURIComponent(slug)}${pinned ? `/${encodeURIComponent(version)}` : ''}`;
	const which = pinned ? `version ${version}` : 'latest version';
	return buildPrompt(
		`Install the SkillPass skill "${slug}" (${which}) with the skillpass CLI, then report what you did.`,
		[
			`1. From the project root run: npx skillpass@latest add ${ref} --target <tool>`,
			`   where <tool> is the agent you are: ${PROMPT_TOOLS.join(', ')}. ${GLOBAL_NOTE}`,
		],
		passport,
	);
}

// The per-agent guide's prompt: the tool is fixed and the reader fills in the slug.
export function toolPrompt(tool: InstallTool): string {
	return buildPrompt(
		'Install the SkillPass skill "<slug>" (latest version) with the skillpass CLI, then report what you did.',
		[`1. From the project root run: npx skillpass@latest add <slug> --target ${tool.slug}`, `   ${GLOBAL_NOTE}`],
		`${SITE_URL}/skills/<slug>`,
	);
}
