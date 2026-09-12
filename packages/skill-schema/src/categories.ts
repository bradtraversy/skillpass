import { z } from 'zod';

export const CATEGORY_SLUGS = [
	'security-review',
	'fuzzing',
	'blockchain',
	'cryptography',
	'code-analysis',
	'testing',
	'agent-workflow',
	'dev-practices',
	'docs-writing',
	'design-creative',
	'knowledge-notes',
	'dev-tooling',
] as const;

export const categorySlugSchema = z.enum(CATEGORY_SLUGS);
export type CategorySlug = z.infer<typeof categorySlugSchema>;

export interface Category {
	slug: CategorySlug;
	label: string;
	description: string;
}

// Slugs are stored in the DB as plain text, so they are frozen once published
// data exists; labels and descriptions are free to change. Descriptions double
// as the classifier's definition of each category, so keep them discriminating.
export const CATEGORIES: Category[] = [
	{
		slug: 'security-review',
		label: 'Security Review',
		description: 'Reviewing code, dependencies, or configuration for vulnerabilities and risky patterns.',
	},
	{
		slug: 'fuzzing',
		label: 'Fuzzing',
		description: 'Fuzzers, fuzzing harnesses, sanitizers, and coverage-guided input generation.',
	},
	{
		slug: 'blockchain',
		label: 'Blockchain',
		description: 'Smart contract and blockchain security, analysis, and development across chains.',
	},
	{
		slug: 'cryptography',
		label: 'Cryptography',
		description: 'Cryptographic implementation review, side-channel testing, and protocol analysis.',
	},
	{
		slug: 'code-analysis',
		label: 'Code Analysis',
		description: 'Static analysis, code graphs, and tooling for navigating and understanding codebases.',
	},
	{
		slug: 'testing',
		label: 'Testing & QA',
		description: 'Writing and running tests: unit, property-based, mutation, browser, and end-to-end.',
	},
	{
		slug: 'agent-workflow',
		label: 'Agent Workflow',
		description: 'Meta skills for how AI agents plan, find and use skills, review work, and coordinate.',
	},
	{
		slug: 'dev-practices',
		label: 'Dev Practices',
		description: 'Software process and craft: planning, git workflow, CI/CD, API design, debugging.',
	},
	{
		slug: 'docs-writing',
		label: 'Docs & Writing',
		description: 'Creating and editing documents and prose: Word, PDF, slides, spreadsheets, comms.',
	},
	{
		slug: 'design-creative',
		label: 'Design & Creative',
		description: 'Visual design and creative output: art, brand assets, UI look and feel, themes.',
	},
	{
		slug: 'knowledge-notes',
		label: 'Notes & Knowledge',
		description: 'Notes and knowledge management: Obsidian, canvases, capturing and organizing info.',
	},
	{
		slug: 'dev-tooling',
		label: 'Dev Tooling',
		description: 'Developer environment and tooling: project setup, CLIs, SDK usage, integrations.',
	},
];
