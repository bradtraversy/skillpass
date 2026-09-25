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

// Own keys only, so `--target constructor` is unknown rather than Object's.
function lookupTool(name: string): InstallTool | undefined {
	return Object.hasOwn(INSTALL_TOOLS, name) ? INSTALL_TOOLS[name] : undefined;
}

// Declared targets that double as install tools.
export const MAPPED_TARGETS = TARGETS.filter((t) => lookupTool(t) !== undefined);

export function layoutTarget(tool: string): Layout | undefined {
	return lookupTool(tool)?.layout;
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
	const tool = lookupTool(target);
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
	// A folder can serve both scopes when the CLI runs from the home directory.
	project: boolean;
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
				if (!existing.tools.includes(name)) existing.tools.push(name);
				existing.project ||= !scope.global;
				existing.global ||= scope.global;
				existing.label = areaLabel(existing);
				continue;
			}
			const area: KnownArea = {
				tools: [name],
				layout: tool.layout,
				project: !scope.global,
				global: scope.global,
				label: '',
				dir: scope.dir,
			};
			area.label = areaLabel(area, scope.display);
			areas.set(scope.dir, area);
		}
	}
	return [...areas.values()];
}

// The display path is fixed on first sight; later merges only widen scope and tools.
function areaLabel(area: KnownArea, display?: string): string {
	const shown = display ?? area.label.slice(0, area.label.indexOf(' ('));
	const scopes = [...(area.project ? ['project'] : []), ...(area.global ? ['user'] : [])].join(', ');
	return `${shown} (${scopes}) - ${area.tools.join(', ')}`;
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
