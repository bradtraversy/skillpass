import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { TARGETS, type Target } from 'skill-schema';

// The declared target whose files a tool reads: Claude Code has its own
// layout, everyone else reads the `.agents` standard that codex introduced.
export type Layout = Extract<Target, 'claude-code' | 'codex'>;

interface InstallTool {
	project: string;
	// Relative to the home directory.
	global: string;
	layout: Layout;
}

const SHARED: InstallTool = { project: join('.agents', 'skills'), global: join('.agents', 'skills'), layout: 'codex' };

// Folders come from each tool's own docs. `agents` names the shared folder
// itself; the tools that document reading it resolve to the same place.
const INSTALL_TOOLS: Record<string, InstallTool> = {
	'claude-code': { project: join('.claude', 'skills'), global: join('.claude', 'skills'), layout: 'claude-code' },
	agents: SHARED,
	codex: SHARED,
	cursor: SHARED,
	windsurf: SHARED,
	'github-copilot': SHARED,
	'gemini-cli': SHARED,
	opencode: SHARED,
	cline: { project: join('.cline', 'skills'), global: join('.cline', 'skills'), layout: 'codex' },
};

export const INSTALL_TOOL_NAMES = Object.keys(INSTALL_TOOLS);

// Declared targets that double as install tools.
export const MAPPED_TARGETS = TARGETS.filter((t) => t in INSTALL_TOOLS);

export function layoutTarget(tool: string): Layout | undefined {
	return INSTALL_TOOLS[tool]?.layout;
}

// A skill declares support for a tool when it names the tool or the layout the
// tool reads, so a `.agents` skill installs into Cursor without a warning.
export function declaresTool(declared: readonly string[], tool: string): boolean {
	const layout = layoutTarget(tool);
	return declared.includes(tool) || (layout !== undefined && declared.includes(layout));
}

export type ResolvedTarget = { ok: true; dir: string } | { ok: false; message: string };

// The skills area itself (pack fan-outs install N members into it).
export function resolveTargetArea(target: string, global = false, home?: string): ResolvedTarget {
	const tool = INSTALL_TOOLS[target];
	if (!tool) {
		if ((TARGETS as readonly string[]).includes(target)) {
			return { ok: false, message: `${target} has no standard skills folder yet; use --dir to pick a location` };
		}
		return { ok: false, message: `unknown target "${target}" (known tools: ${INSTALL_TOOL_NAMES.join(', ')})` };
	}
	return { ok: true, dir: global ? join(home ?? homedir(), tool.global) : tool.project };
}

export function resolveTargetDir(target: string, slug: string, global = false, home?: string): ResolvedTarget {
	const area = resolveTargetArea(target, global, home);
	return area.ok ? { ok: true, dir: join(area.dir, slug) } : area;
}

// The tip shown when no --target/--dir was given but one would apply.
export function mappableDeclaredTargets(declared: Target[]): Target[] {
	return declared.filter((t) => MAPPED_TARGETS.includes(t));
}

export interface KnownArea {
	// Every tool that reads this folder, in registry order.
	tools: string[];
	layout: Layout;
	global: boolean;
	label: string;
	// Absolute path.
	dir: string;
}

// One entry per distinct folder: six tools read `.agents/skills`, and list,
// outdated, remove, and update must see it once.
export function knownAreas(cwd: string, home?: string): KnownArea[] {
	const areas = new Map<string, KnownArea>();
	for (const [name, tool] of Object.entries(INSTALL_TOOLS)) {
		const scopes = [
			{ global: false, display: tool.project, dir: resolve(cwd, tool.project) },
			{ global: true, display: join(home ?? homedir(), tool.global), dir: join(home ?? homedir(), tool.global) },
		];
		for (const scope of scopes) {
			const existing = areas.get(scope.dir);
			if (existing) {
				existing.tools.push(name);
				existing.label = areaLabel(scope.display, scope.global, existing.tools);
				continue;
			}
			areas.set(scope.dir, {
				tools: [name],
				layout: tool.layout,
				global: scope.global,
				label: areaLabel(scope.display, scope.global, [name]),
				dir: scope.dir,
			});
		}
	}
	return [...areas.values()];
}

function areaLabel(display: string, global: boolean, tools: string[]): string {
	return `${display} (${global ? 'user' : 'project'}) - ${tools.join(', ')}`;
}

export type ResolvedArea = { ok: true; area: KnownArea } | { ok: false; message: string };

// The known area a --target names, with its layout and the tools sharing it.
export function resolveArea(target: string, global: boolean, cwd: string, home?: string): ResolvedArea {
	const resolved = resolveTargetArea(target, global, home);
	if (!resolved.ok) {
		return resolved;
	}
	const dir = resolve(cwd, resolved.dir);
	const area = knownAreas(cwd, home).find((a) => a.dir === dir);
	return area ? { ok: true, area } : { ok: false, message: `no known skills area for ${target}` };
}
