import { z } from 'zod';

export const INTEGRATION_SLUGS = [
	'github',
	'obsidian',
	'office-files',
	'pdf',
	'browser',
	'docker',
	'mcp',
	'anthropic-api',
	'gmail',
	'google-calendar',
	'google-drive',
	'slack',
	'notion',
	'jira',
	'aws',
	'kubernetes',
	'postgres',
	'redis',
] as const;

export const integrationSlugSchema = z.enum(INTEGRATION_SLUGS);
export type IntegrationSlug = z.infer<typeof integrationSlugSchema>;

export interface Integration {
	slug: IntegrationSlug;
	label: string;
	description: string;
}

// Slugs are stored in the DB as text-array elements, so they are frozen once
// published data exists; labels and descriptions are free to change.
// Descriptions double as the classifier's definition of each integration, so
// they describe what a skill must actually touch to qualify - not merely
// mention in passing.
export const INTEGRATIONS: Integration[] = [
	{
		slug: 'github',
		label: 'GitHub',
		description:
			'Operates on GitHub itself: repos, pull requests, issues, releases, or Actions, via the gh CLI or GitHub API. Plain local git usage does not qualify.',
	},
	{
		slug: 'obsidian',
		label: 'Obsidian',
		description: 'Reads or writes Obsidian vaults, notes, canvases, or plugins, or drives the Obsidian app or CLI.',
	},
	{
		slug: 'office-files',
		label: 'Office files',
		description: 'Creates or edits Word (.docx), PowerPoint (.pptx), or Excel/spreadsheet (.xlsx, .csv) documents.',
	},
	{
		slug: 'pdf',
		label: 'PDF',
		description: 'Reads, creates, fills, merges, or extracts content from PDF files.',
	},
	{
		slug: 'browser',
		label: 'Browser',
		description:
			'Drives a real web browser: Playwright, Puppeteer, Chrome DevTools, screenshots, or web-app interaction.',
	},
	{
		slug: 'docker',
		label: 'Docker',
		description: 'Builds, runs, or configures Docker containers, images, or dev containers.',
	},
	{
		slug: 'mcp',
		label: 'MCP',
		description: 'Builds, configures, or connects Model Context Protocol servers or clients.',
	},
	{
		slug: 'anthropic-api',
		label: 'Anthropic API',
		description:
			'Calls the Anthropic/Claude API directly: messages, tool use, SDK usage, or prompt pipelines against api.anthropic.com.',
	},
	{
		slug: 'gmail',
		label: 'Gmail',
		description: 'Reads, searches, drafts, or sends email through Gmail.',
	},
	{
		slug: 'google-calendar',
		label: 'Google Calendar',
		description: 'Reads or manages events, availability, or scheduling in Google Calendar.',
	},
	{
		slug: 'google-drive',
		label: 'Google Drive',
		description: 'Reads, writes, or organizes files in Google Drive or Google Docs/Sheets.',
	},
	{
		slug: 'slack',
		label: 'Slack',
		description: 'Posts to, reads, or automates Slack channels, messages, or workflows.',
	},
	{
		slug: 'notion',
		label: 'Notion',
		description: 'Reads or writes Notion pages, databases, or workspaces.',
	},
	{
		slug: 'jira',
		label: 'Jira',
		description: 'Creates, updates, or queries Jira issues, boards, or projects.',
	},
	{
		slug: 'aws',
		label: 'AWS',
		description: 'Provisions or operates AWS services: S3, Lambda, EC2, IAM, CloudFormation, or the AWS CLI.',
	},
	{
		slug: 'kubernetes',
		label: 'Kubernetes',
		description: 'Deploys to or operates Kubernetes clusters: kubectl, manifests, Helm.',
	},
	{
		slug: 'postgres',
		label: 'Postgres',
		description:
			'Queries, migrates, or administers PostgreSQL databases specifically. Generic SQL advice does not qualify.',
	},
	{
		slug: 'redis',
		label: 'Redis',
		description: 'Uses Redis for caching, queues, or data structures.',
	},
];
