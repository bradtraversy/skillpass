// Mirrors the CLI's install registry; keep in step with packages/cli/src/targets.ts.
// `layout` is the declared target whose files a tool reads: Claude Code has its
// own folder layout, everyone else reads the `.agents` standard.
export type Layout = 'claude-code' | 'agents';

export interface InstallTool {
	slug: string;
	name: string;
	project: string;
	user: string;
	layout: Layout;
}

const AGENTS = { project: '.agents/skills', user: '~/.agents/skills', layout: 'agents' } as const;

export const INSTALL_TOOLS: readonly InstallTool[] = [
	{
		slug: 'claude-code',
		name: 'Claude Code',
		project: '.claude/skills',
		user: '~/.claude/skills',
		layout: 'claude-code',
	},
	{ slug: 'codex', name: 'Codex', ...AGENTS },
	{ slug: 'cursor', name: 'Cursor', ...AGENTS },
	{ slug: 'windsurf', name: 'Windsurf', ...AGENTS },
	{ slug: 'github-copilot', name: 'GitHub Copilot', ...AGENTS },
	{ slug: 'gemini-cli', name: 'Gemini CLI', ...AGENTS },
	{ slug: 'cline', name: 'Cline', project: '.cline/skills', user: '~/.cline/skills', layout: 'agents' },
	{ slug: 'opencode', name: 'OpenCode', ...AGENTS },
];

export function findInstallTool(slug: string): InstallTool | undefined {
	return INSTALL_TOOLS.find((tool) => tool.slug === slug);
}

// The other tools that read the same project folder, so one install serves them all.
export function sharedWith(tool: InstallTool): InstallTool[] {
	return INSTALL_TOOLS.filter((other) => other.slug !== tool.slug && other.project === tool.project);
}
