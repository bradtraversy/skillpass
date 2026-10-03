import {
	CATEGORY_SLUGS,
	DISTRIBUTIONS,
	INTEGRATION_SLUGS,
	RISK_LEVELS,
	TARGETS,
	VALIDATION_STATUSES,
	type PublicPreflight,
	type PublicSkillDetail,
	type PublicSkillSummary,
	type PublicSkillVersion,
	type SkillPassport,
} from 'skill-schema';

export const API_BASE = 'https://api.skillpass.dev';

export interface FieldDoc {
	name: string;
	type: string;
	description: string;
}

const oneOf = (values: readonly string[]) => values.map((value) => `"${value}"`).join(' | ');

const STATUS = oneOf(VALIDATION_STATUSES);
const RISK = oneOf(RISK_LEVELS);
const PERMISSION_SETS = '{ declared: string[], detected: string[] }';

export const PASSPORT_FIELDS: FieldDoc[] = [
	{ name: 'schemaVersion', type: '"0.1"', description: 'Passport format version.' },
	{ name: 'validationStatus', type: STATUS, description: 'Overall validation result for this version.' },
	{ name: 'riskLevel', type: RISK, description: 'Risk level the validator assigned to this version.' },
	{
		name: 'permissionsSummary',
		type: PERMISSION_SETS,
		description:
			'Permission keys the manifest declares and the ones the validator detected in the files. A gap between the two is itself a signal.',
	},
	{
		name: 'warningsSummary',
		type: '{ code, message, location? }[]',
		description: 'Advisory findings. location is { path, line?, snippet? } when the finding points at a file.',
	},
	{
		name: 'distribution',
		type: oneOf(DISTRIBUTIONS),
		description: 'How the listing is obtained; the skill page uses it to pick the install call to action.',
	},
	{
		name: 'homepage',
		type: 'string (URL), optional',
		description: 'Homepage from skill.json, if the author gave one.',
	},
	{
		name: 'install',
		type: 'string, optional',
		description: 'Install instruction from skill.json, if the author gave one.',
	},
	{
		name: 'manifestInferred',
		type: 'boolean',
		description:
			'True when there was no skill.json and the manifest was built from SKILL.md, so permissions were inferred rather than declared.',
	},
	{
		name: 'sourceHash',
		type: 'string',
		description:
			'Hash of the exact files that were validated, as "sha256:<hex>". Downloads and the CLI check against it.',
	},
	{
		name: 'resolvedCommitSha',
		type: 'string, optional',
		description: 'Git commit a GitHub submission was pinned to. Missing for zip uploads.',
	},
	{ name: 'engineVersion', type: 'string', description: 'Version of the validator that produced the passport.' },
	{ name: 'generatedAt', type: 'string (ISO 8601)', description: 'When the passport was generated.' },
	{ name: 'signature', type: 'string, optional', description: 'Not set today.' },
];

export const SUMMARY_FIELDS: FieldDoc[] = [
	{ name: 'slug', type: 'string', description: 'Directory identifier, used in every per-skill path.' },
	{ name: 'name', type: 'string', description: 'Skill name from the package.' },
	{ name: 'summary', type: 'string', description: 'Description from the package.' },
	{ name: 'targets', type: `(${oneOf(TARGETS)})[]`, description: 'Agent tools the skill declares.' },
	{ name: 'validationStatus', type: STATUS, description: 'Validation result of the latest published version.' },
	{ name: 'riskLevel', type: RISK, description: 'Risk level of the latest published version.' },
	{
		name: 'noteCount',
		type: 'integer, optional',
		description: 'Number of advisory findings on the latest version.',
	},
	{
		name: 'category',
		type: 'string | null, optional',
		description: `One of ${CATEGORY_SLUGS.length} browse category slugs, such as "${CATEGORY_SLUGS[0]}". Null until classified.`,
	},
	{
		name: 'displayName',
		type: 'string | null, optional',
		description: 'Display name written at publish. Null until generated.',
	},
	{
		name: 'tagline',
		type: 'string | null, optional',
		description: 'One-line tagline written at publish. Null until generated.',
	},
	{
		name: 'integrations',
		type: 'string[] | null, optional',
		description: `Services the skill works with, from ${INTEGRATION_SLUGS.length} integration slugs such as "${INTEGRATION_SLUGS[0]}". Null when never classified, empty when none.`,
	},
	{
		name: 'packSkills',
		type: 'string[] | null, optional',
		description: 'Member skill names when the listing is a multi-skill pack. Null for a single skill.',
	},
	{ name: 'version', type: 'string', description: 'Latest published version, as semver.' },
	{ name: 'maintainer', type: 'string', description: 'GitHub login of the account that listed the skill.' },
	{
		name: 'attributedTo',
		type: 'string | null',
		description: 'GitHub login of the source repo owner when someone else listed the skill. Null otherwise.',
	},
	{ name: 'featured', type: 'boolean', description: 'On the curated Featured list.' },
	{
		name: 'verified',
		type: 'boolean',
		description:
			'Admin-set curation flag. Every curated listing carries it, so it does not by itself mean first-party.',
	},
	{ name: 'publishedAt', type: 'string (ISO 8601)', description: 'When the latest version was published.' },
];

export const DETAIL_FIELDS: FieldDoc[] = [
	{
		name: 'packMembers',
		type: '{ name, description?, entry, targets?, permissions?, variants? }[] | null, optional',
		description: 'Full member entries for a pack, including per-target variant paths. Null for a single skill.',
	},
	{
		name: 'githubRepoUrl',
		type: 'string | null',
		description: 'Source repository URL for GitHub submissions. Null for zip uploads.',
	},
	{ name: 'passport', type: 'SkillPassport', description: 'The Skill Passport for this version (see above).' },
	{
		name: 'maintainerInfo',
		type: '{ username, displayName, avatarUrl }',
		description: 'Public profile of the maintainer.',
	},
	{ name: 'versions', type: 'Version[]', description: 'Every published version, newest first.' },
	{
		name: 'aiReview',
		type: '{ summary, verdict, reasoning, model, reviewedAt } | null',
		description:
			'The AI review of this version\'s files; verdict is "clear" | "caution" | "concern". Advisory, never a guarantee. Null until generated.',
	},
];

export const VERSION_FIELDS: FieldDoc[] = [
	{ name: 'version', type: 'string', description: 'The version, as semver.' },
	{ name: 'validationStatus', type: STATUS, description: 'Validation result of this version.' },
	{ name: 'riskLevel', type: RISK, description: 'Risk level of this version.' },
	{ name: 'publishedAt', type: 'string (ISO 8601)', description: 'When this version was published.' },
];

export const PREFLIGHT_FIELDS: FieldDoc[] = [
	{ name: 'version', type: 'string', description: 'The pinned version.' },
	{ name: 'validationStatus', type: STATUS, description: 'Validation result of the pinned version.' },
	{ name: 'riskLevel', type: RISK, description: 'Risk level of the pinned version.' },
	{ name: 'sourceHash', type: 'string', description: 'The pinned source hash from the passport.' },
	{
		name: 'sourceVerified',
		type: 'boolean',
		description: 'True when the stored snapshot still hashes to sourceHash.',
	},
	{
		name: 'resolvedCommitSha',
		type: 'string | null',
		description: 'Git commit a GitHub submission was pinned to. Null for zip uploads.',
	},
	{ name: 'generatedAt', type: 'string (ISO 8601)', description: 'When the passport was generated.' },
	{ name: 'permissions', type: PERMISSION_SETS, description: 'Declared and detected permission keys.' },
	{
		name: 'diff',
		type: '{ previousVersion, declared: { added, removed }, detected: { added, removed } } | null',
		description: 'Permission changes against the previous published version. Null for the first version.',
	},
	{ name: 'blocked', type: 'boolean', description: 'True when validation failed; the download route refuses it.' },
	{ name: 'blockedReason', type: 'string | null', description: 'Why the version is blocked. Null when not blocked.' },
];

// Trimmed from the live pdf listing; the test parses these with the real schemas.
export const EXAMPLE_PASSPORT = {
	schemaVersion: '0.1',
	validationStatus: 'passed',
	riskLevel: 'low',
	permissionsSummary: { declared: [], detected: ['shell.execute'] },
	warningsSummary: [],
	distribution: 'skill',
	manifestInferred: true,
	sourceHash: 'sha256:6a01b6dc757b8856d7eba5e9985d8550783f946d7afdf86402ba324b93239fc0',
	resolvedCommitSha: 'fa0fa64bdc967915dc8399e803be67759e1e62b8',
	engineVersion: '0.1.0',
	generatedAt: '2026-07-21T17:18:10.773Z',
} satisfies SkillPassport;

export const EXAMPLE_VERSION = {
	version: '1.0.0',
	validationStatus: 'passed',
	riskLevel: 'low',
	publishedAt: '2026-07-21T17:18:10.773Z',
} satisfies PublicSkillVersion;

export const EXAMPLE_SUMMARY = {
	slug: 'pdf',
	name: 'pdf',
	summary: 'Use this skill whenever the user wants to do anything with PDF files.',
	targets: ['claude-code', 'codex'],
	validationStatus: 'passed',
	riskLevel: 'low',
	noteCount: 0,
	category: 'docs-writing',
	displayName: 'PDF Processing',
	tagline: 'Read, extract, merge, split, transform, and create PDF files.',
	integrations: ['pdf'],
	packSkills: null,
	version: '1.0.0',
	maintainer: 'bradtraversy',
	attributedTo: 'anthropics',
	featured: true,
	verified: true,
	publishedAt: '2026-07-21T17:18:10.773Z',
} satisfies PublicSkillSummary;

export const EXAMPLE_DETAIL = {
	...EXAMPLE_SUMMARY,
	packMembers: null,
	githubRepoUrl: 'https://github.com/anthropics/skills/tree/main/skills/pdf',
	passport: EXAMPLE_PASSPORT,
	maintainerInfo: {
		username: 'bradtraversy',
		displayName: 'Brad Traversy',
		avatarUrl: 'https://avatars.githubusercontent.com/u/5550850?v=4',
	},
	versions: [EXAMPLE_VERSION],
	aiReview: {
		summary: 'A skill for common PDF operations: reading, extracting text and tables, merging, splitting, and OCR.',
		verdict: 'caution',
		reasoning: 'The skill documents command-line tools that run external processes, so review its scripts first.',
		model: 'claude-haiku-4-5',
		reviewedAt: '2026-07-26T13:17:38.386Z',
	},
} satisfies PublicSkillDetail;

export const EXAMPLE_PREFLIGHT = {
	version: '1.0.0',
	validationStatus: 'passed',
	riskLevel: 'low',
	sourceHash: EXAMPLE_PASSPORT.sourceHash,
	sourceVerified: true,
	resolvedCommitSha: EXAMPLE_PASSPORT.resolvedCommitSha,
	generatedAt: EXAMPLE_PASSPORT.generatedAt,
	permissions: EXAMPLE_PASSPORT.permissionsSummary,
	diff: null,
	blocked: false,
	blockedReason: null,
} satisfies PublicPreflight;

export const json = (value: unknown) => JSON.stringify(value, null, 2);
