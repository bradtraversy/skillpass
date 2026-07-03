// Fixture-level; superseded by packages/skill-schema at feature 3.

import type { RiskLevel, Verdict } from './skills';
import { skills } from './skills';

export interface PermissionEntry {
	key: string; // e.g. 'filesystem.read', 'network', 'env.read', 'shell.exec'
	description: string;
	level: RiskLevel;
}

export interface Finding {
	title: string;
	body: string;
	severity: 'warning' | 'failure';
	code?: { location: string; snippet: string; highlight?: string };
}

export interface SkillVersionRow {
	version: string;
	verdict: Verdict;
	date: string; // display string
	current?: boolean;
}

export interface SkillFile {
	name: string;
	size: string; // display string, e.g. '4.8 KB'
}

export interface MaintainerInfo {
	username: string;
	reputation: number;
	skillCount: number;
	joined: string; // display, e.g. '2024'
}

export interface SkillDetail {
	slug: string; // FK to Skill.slug
	version: string; // current passport version, e.g. 'v2.1.0'
	githubRepoUrl: string;
	sourceHash: string; // short display hash -> SkillPassport.sourceHash
	resolvedCommitSha: string; // short display sha -> SkillVersion.resolvedCommitSha
	validated: string; // display, e.g. '3 days ago'
	usage: string;
	permissions: PermissionEntry[]; // -> SkillPassport.permissionsSummary
	findings: Finding[]; // -> SkillPassport.warningsSummary + failures
	files: SkillFile[];
	versions: SkillVersionRow[];
	maintainerInfo: MaintainerInfo;
}

const details: SkillDetail[] = [
	{
		slug: 'commit-message-writer',
		version: 'v3.0.1',
		githubRepoUrl: 'https://github.com/traversymedia/commit-message-writer',
		sourceHash: 'b91d4a2f',
		resolvedCommitSha: '7c1e0ab',
		validated: '1 day ago',
		usage: 'Stage your changes, then run the skill. It reads the staged diff, infers the change type and scope, and drafts a conventional commit message. It never touches the network or runs shell commands.',
		permissions: [
			{
				key: 'filesystem.read',
				description: 'Reads the staged diff from the working tree.',
				level: 'low',
			},
		],
		findings: [],
		files: [
			{ name: 'skill.json', size: '0.9 KB' },
			{ name: 'SKILL.md', size: '3.1 KB' },
		],
		versions: [
			{ version: 'v3.0.1', verdict: 'passed', date: 'current · 1 day ago', current: true },
			{ version: 'v3.0.0', verdict: 'passed', date: 'Jun 18' },
			{ version: 'v2.2.0', verdict: 'passed', date: 'Apr 2' },
		],
		maintainerInfo: { username: 'traversymedia', reputation: 512, skillCount: 9, joined: '2023' },
	},
	{
		slug: 'ai-coding-blueprint',
		version: 'v1.4.0',
		githubRepoUrl: 'https://github.com/bradtraversy/ai-blueprint',
		sourceHash: 'd4c8e011',
		resolvedCommitSha: '98e1db3',
		validated: '2 days ago',
		usage: 'Overlay the Blueprint onto a scaffolded app. It drives a spec-driven feature loop with reviewed steps behind gates, reading and writing project files as it plans, builds, and logs each feature.',
		permissions: [
			{
				key: 'filesystem.read',
				description: 'Reads project files, plans, and the current spec.',
				level: 'low',
			},
			{
				key: 'filesystem.write',
				description: 'Writes specs, history logs, and generated context files.',
				level: 'low',
			},
		],
		findings: [],
		files: [
			{ name: 'skill.json', size: '1.4 KB' },
			{ name: 'SKILL.md', size: '6.2 KB' },
			{ name: 'examples/feature.md', size: '2.7 KB' },
		],
		versions: [
			{ version: 'v1.4.0', verdict: 'passed', date: 'current · 2 days ago', current: true },
			{ version: 'v1.3.0', verdict: 'passed', date: 'Jun 9' },
			{ version: 'v1.2.1', verdict: 'passed', date: 'May 20' },
		],
		maintainerInfo: { username: 'bradtraversy', reputation: 604, skillCount: 5, joined: '2023' },
	},
	{
		slug: 'repo-triage',
		version: 'v1.1.2',
		githubRepoUrl: 'https://github.com/octotools/repo-triage',
		sourceHash: 'a17f9be3',
		resolvedCommitSha: '2f0b7cd',
		validated: '2 days ago',
		usage: 'Point it at a repo. It reads the tree and open issues, groups them by area, and drafts a triage plan. Git access is read-only (log, diff, status); it makes no commits and pushes nothing.',
		permissions: [
			{
				key: 'filesystem.read',
				description: 'Reads the repository tree and issue exports.',
				level: 'low',
			},
			{
				key: 'shell.exec',
				description: 'Runs read-only git commands (log, diff, status).',
				level: 'medium',
			},
		],
		findings: [],
		files: [
			{ name: 'skill.json', size: '1.1 KB' },
			{ name: 'SKILL.md', size: '4.4 KB' },
			{ name: 'examples/triage.md', size: '1.9 KB' },
		],
		versions: [
			{ version: 'v1.1.2', verdict: 'passed', date: 'current · 2 days ago', current: true },
			{ version: 'v1.1.0', verdict: 'passed', date: 'May 30' },
			{ version: 'v1.0.0', verdict: 'passed', date: 'Mar 14' },
		],
		maintainerInfo: { username: 'octotools', reputation: 341, skillCount: 12, joined: '2022' },
	},
	{
		slug: 'pr-review-bot',
		version: 'v2.1.0',
		githubRepoUrl: 'https://github.com/reviewhub/pr-review-bot',
		sourceHash: 'a3f9c7e1',
		resolvedCommitSha: 'e4b1d09',
		validated: '3 days ago',
		usage: 'Point it at an open PR. It reads the diff, drafts a summary and inline notes, and - with confirmation - posts them back. Supported on Codex and Claude Code.',
		permissions: [
			{
				key: 'filesystem.read',
				description: 'Reads changed files and the diff in the working tree.',
				level: 'low',
			},
			{
				key: 'network',
				description: 'Calls the GitHub API to post review comments.',
				level: 'medium',
			},
			{
				key: 'env.read',
				description: 'Reads GITHUB_TOKEN from the environment.',
				level: 'medium',
			},
		],
		findings: [
			{
				title: 'Outbound network to an undeclared host',
				body: 'Posts to api.github.com (declared) but also references a telemetry endpoint not listed in the manifest.',
				severity: 'warning',
				code: {
					location: 'SKILL.md:42',
					snippet: 'fetch("https://t.reviewhub.io/collect", ...)',
					highlight: 'https://t.reviewhub.io/collect',
				},
			},
			{
				title: 'Broad "post comments automatically" instruction',
				body: 'Auto-posting to GitHub is a send action. Recommend gating behind explicit confirmation before publish.',
				severity: 'warning',
			},
		],
		files: [
			{ name: 'skill.json', size: '1.2 KB' },
			{ name: 'SKILL.md', size: '4.8 KB' },
			{ name: 'examples/review.md', size: '2.1 KB' },
		],
		versions: [
			{ version: 'v2.1.0', verdict: 'warning', date: 'current · 3 days ago', current: true },
			{ version: 'v2.0.1', verdict: 'passed', date: 'Feb 12' },
			{ version: 'v1.4.0', verdict: 'passed', date: 'Jan 3' },
		],
		maintainerInfo: { username: 'reviewhub', reputation: 218, skillCount: 6, joined: '2024' },
	},
	{
		slug: 'gmail-sweep',
		version: 'v0.9.0',
		githubRepoUrl: 'https://github.com/inboxlabs/gmail-sweep',
		sourceHash: 'c5e2a740',
		resolvedCommitSha: '1a9f3e2',
		validated: 'in review',
		usage: 'Runs a weekly pass over your inbox, applying labels and archiving by rule. Uses the Gmail connector, which grants write access to your mail - review the rules before enabling.',
		permissions: [
			{
				key: 'network',
				description: 'Uses the Gmail connector to read and modify messages.',
				level: 'high',
			},
			{
				key: 'filesystem.read',
				description: 'Reads the local rules file that drives labeling.',
				level: 'low',
			},
		],
		findings: [
			{
				title: 'Connector write scope with no per-run confirmation',
				body: 'The Gmail connector can archive and relabel mail unattended. Recommend a dry-run mode or explicit confirmation before the first destructive pass.',
				severity: 'warning',
			},
		],
		files: [
			{ name: 'skill.json', size: '1.3 KB' },
			{ name: 'SKILL.md', size: '5.0 KB' },
			{ name: 'rules.example.yml', size: '0.8 KB' },
		],
		versions: [
			{ version: 'v0.9.0', verdict: 'warning', date: 'current · in review', current: true },
			{ version: 'v0.8.0', verdict: 'passed', date: 'May 8' },
		],
		maintainerInfo: { username: 'inboxlabs', reputation: 96, skillCount: 3, joined: '2025' },
	},
	{
		slug: 'memcrate-context-vault',
		version: 'v2.0.0',
		githubRepoUrl: 'https://github.com/memcrate/context-vault',
		sourceHash: 'f082b6d9',
		resolvedCommitSha: '5d7c0af',
		validated: '4 days ago',
		usage: 'A portable, local-first context vault. Three verbs any agent can read: remember, recall, forget. Everything stays in local markdown; nothing leaves the machine.',
		permissions: [
			{
				key: 'filesystem.read',
				description: 'Reads context entries from the local vault.',
				level: 'low',
			},
			{
				key: 'filesystem.write',
				description: 'Writes and prunes context entries in the local vault.',
				level: 'low',
			},
		],
		findings: [],
		files: [
			{ name: 'skill.json', size: '1.0 KB' },
			{ name: 'SKILL.md', size: '3.9 KB' },
		],
		versions: [
			{ version: 'v2.0.0', verdict: 'passed', date: 'current · 4 days ago', current: true },
			{ version: 'v1.2.0', verdict: 'passed', date: 'Apr 21' },
			{ version: 'v1.0.0', verdict: 'passed', date: 'Feb 1' },
		],
		maintainerInfo: { username: 'memcrate', reputation: 287, skillCount: 4, joined: '2024' },
	},
	{
		slug: 'auto-deploy-runner',
		version: 'v0.3.0',
		githubRepoUrl: 'https://github.com/shipfast/auto-deploy-runner',
		sourceHash: '9b3311c0',
		resolvedCommitSha: 'c0ffee1',
		validated: 'blocked',
		usage: 'Runs the build and deploys on every merge to main. Validation blocked this skill: it executes shell and ships to production with no confirmation step.',
		permissions: [
			{
				key: 'shell.exec',
				description: 'Runs arbitrary build and deploy shell commands.',
				level: 'critical',
			},
			{
				key: 'network',
				description: 'Pushes artifacts to the deploy provider.',
				level: 'high',
			},
		],
		findings: [
			{
				title: 'Ungated shell execution and production deploy',
				body: 'The skill runs shell and deploys to production automatically on merge, with no confirmation gate. This is a send/execute action that can affect live systems without review.',
				severity: 'failure',
				code: {
					location: 'SKILL.md:17',
					snippet: 'run("npm run build && npm run deploy --prod")',
					highlight: 'deploy --prod',
				},
			},
		],
		files: [
			{ name: 'skill.json', size: '0.7 KB' },
			{ name: 'SKILL.md', size: '2.3 KB' },
		],
		versions: [
			{ version: 'v0.3.0', verdict: 'failed', date: 'current · blocked', current: true },
			{ version: 'v0.2.0', verdict: 'failed', date: 'Jun 1' },
		],
		maintainerInfo: { username: 'shipfast', reputation: 12, skillCount: 2, joined: '2025' },
	},
	{
		slug: 'course-author',
		version: 'v1.0.0',
		githubRepoUrl: 'https://github.com/startdev/course-author',
		sourceHash: 'e6a1d5b8',
		resolvedCommitSha: '3b8e0f4',
		validated: '5 days ago',
		usage: 'Feed it a course outline. It generates lessons, challenges, and tests, writing them into your course directory. Reads the outline, writes the generated files; no network.',
		permissions: [
			{
				key: 'filesystem.read',
				description: 'Reads the course outline and existing lesson files.',
				level: 'low',
			},
			{
				key: 'filesystem.write',
				description: 'Writes generated lessons, challenges, and tests.',
				level: 'low',
			},
		],
		findings: [],
		files: [
			{ name: 'skill.json', size: '1.1 KB' },
			{ name: 'SKILL.md', size: '4.1 KB' },
			{ name: 'examples/lesson.md', size: '2.5 KB' },
		],
		versions: [
			{ version: 'v1.0.0', verdict: 'passed', date: 'current · 5 days ago', current: true },
			{ version: 'v0.9.0', verdict: 'passed', date: 'Apr 30' },
		],
		maintainerInfo: { username: 'startdev', reputation: 173, skillCount: 7, joined: '2024' },
	},
];

export const skillDetails: Record<string, SkillDetail> = Object.fromEntries(
	details.map((detail) => [detail.slug, detail]),
);

export function getSkillDetail(slug: string): SkillDetail | undefined {
	return skillDetails[slug];
}

export const detailSlugs: string[] = details.map((detail) => detail.slug);
export const skillSlugs: string[] = skills.map((skill) => skill.slug);
