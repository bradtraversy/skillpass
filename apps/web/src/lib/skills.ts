// Fixture dataset for the static directory. The Skill shape is load-bearing:
// feature 2 (detail + passport) reuses it, so treat it as a contract. It aligns
// with, and is superseded by, packages/skill-schema at feature 3.

export type Verdict = 'passed' | 'warning' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Target = 'codex' | 'claude-code' | 'cursor' | 'cowork' | 'aider';

export interface Skill {
	slug: string;
	name: string;
	summary: string;
	targets: Target[];
	verdict: Verdict; // Stamp renders PASS / WARN / FAIL
	riskLevel: RiskLevel;
	category: string;
	tags: string[];
	maintainer: string; // username
	installs: number;
	lastValidated: string; // display string for fixtures (e.g. "2d ago")
}

export const skills: Skill[] = [
	{
		slug: 'commit-message-writer',
		name: 'Commit Message Writer',
		summary: 'Writes conventional commit messages from the staged diff. No network, no shell.',
		targets: ['codex', 'cursor'],
		verdict: 'passed',
		riskLevel: 'low',
		category: 'Git',
		tags: ['git', 'commits', 'conventional-commits'],
		maintainer: 'traversymedia',
		installs: 5900,
		lastValidated: '1d ago',
	},
	{
		slug: 'ai-coding-blueprint',
		name: 'AI Coding Blueprint',
		summary:
			'Spec-driven feature workflow with reviewed steps behind gates. Reads and writes project files.',
		targets: ['claude-code', 'codex'],
		verdict: 'passed',
		riskLevel: 'low',
		category: 'Workflow',
		tags: ['workflow', 'spec-driven', 'review-gates'],
		maintainer: 'bradtraversy',
		installs: 4200,
		lastValidated: '2d ago',
	},
	{
		slug: 'repo-triage',
		name: 'Repo Triage',
		summary: 'Scans a repo, groups issues, and drafts a triage plan. Reads files and runs read-only git.',
		targets: ['claude-code', 'codex'],
		verdict: 'passed',
		riskLevel: 'medium',
		category: 'Code Review',
		tags: ['issues', 'triage', 'git'],
		maintainer: 'octotools',
		installs: 3600,
		lastValidated: '2d ago',
	},
	{
		slug: 'pr-review-bot',
		name: 'PR Review Bot',
		summary: 'Summarizes diffs and posts review notes. Requests network access to the GitHub API.',
		targets: ['codex', 'claude-code'],
		verdict: 'warning',
		riskLevel: 'medium',
		category: 'Code Review',
		tags: ['pull-requests', 'github', 'review'],
		maintainer: 'reviewhub',
		installs: 1100,
		lastValidated: 'review',
	},
	{
		slug: 'gmail-sweep',
		name: 'Gmail Sweep',
		summary: 'Weekly inbox triage and labeling. Requests connector write access to Gmail.',
		targets: ['cowork'],
		verdict: 'warning',
		riskLevel: 'high',
		category: 'Productivity',
		tags: ['email', 'gmail', 'automation'],
		maintainer: 'inboxlabs',
		installs: 870,
		lastValidated: 'review',
	},
	{
		slug: 'memcrate-context-vault',
		name: 'Memcrate Context Vault',
		summary: 'Portable, local-first context vault. Three verbs any agent can read. No network.',
		targets: ['claude-code', 'cursor', 'aider'],
		verdict: 'passed',
		riskLevel: 'low',
		category: 'Context',
		tags: ['memory', 'context', 'local-first'],
		maintainer: 'memcrate',
		installs: 2800,
		lastValidated: '4d ago',
	},
	{
		slug: 'auto-deploy-runner',
		name: 'Auto Deploy Runner',
		summary: 'Runs build and deploy on merge. Executes shell and deploys with no explicit gate.',
		targets: ['aider'],
		verdict: 'failed',
		riskLevel: 'critical',
		category: 'Deployment',
		tags: ['deploy', 'ci', 'shell'],
		maintainer: 'shipfast',
		installs: 0,
		lastValidated: 'blocked',
	},
	{
		slug: 'course-author',
		name: 'Course Author',
		summary: 'Generates lessons, challenges, and tests from a course outline.',
		targets: ['claude-code'],
		verdict: 'passed',
		riskLevel: 'low',
		category: 'Content',
		tags: ['education', 'content', 'generation'],
		maintainer: 'startdev',
		installs: 640,
		lastValidated: '5d ago',
	},
];
