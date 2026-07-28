import { z } from 'zod';

export const seedListingSchema = z.object({
	githubUrl: z.url(),
	attributedTo: z.string().min(1),
	featured: z.boolean().optional(),
});

export type SeedListing = z.infer<typeof seedListingSchema>;

export const seedManifestSchema = z.array(seedListingSchema);

// Wave 1: the 17 official anthropics/skills, each a subfolder addressed by
// subpath. Later waves extend this array; the seed engine doesn't change.
const ANTHROPIC_SKILLS = [
	'algorithmic-art',
	'brand-guidelines',
	'canvas-design',
	'claude-api',
	'doc-coauthoring',
	'docx',
	'frontend-design',
	'internal-comms',
	'mcp-builder',
	'pdf',
	'pptx',
	'skill-creator',
	'slack-gif-creator',
	'theme-factory',
	'web-artifacts-builder',
	'webapp-testing',
	'xlsx',
];

const FEATURED = new Set(['pdf', 'mcp-builder', 'skill-creator']);

// Waves 2-5 (discovered 2026-07-25): the community and security sources recorded
// in the launch-seed notes. One entry per skill folder; trailofbits nests skills
// under plugins, so those entries are full subpaths.
const AGENT_SKILLS = [
	'api-and-interface-design',
	'browser-testing-with-devtools',
	'ci-cd-and-automation',
	'code-review-and-quality',
	'code-simplification',
	'context-engineering',
	'debugging-and-error-recovery',
	'deprecation-and-migration',
	'documentation-and-adrs',
	'doubt-driven-development',
	'frontend-ui-engineering',
	'git-workflow-and-versioning',
	'idea-refine',
	'incremental-implementation',
	'interview-me',
	'observability-and-instrumentation',
	'performance-optimization',
	'planning-and-task-breakdown',
	'security-and-hardening',
	'shipping-and-launch',
	'source-driven-development',
	'spec-driven-development',
	'test-driven-development',
	'using-agent-skills',
];

const SUPERPOWERS_SKILLS = [
	'brainstorming',
	'dispatching-parallel-agents',
	'executing-plans',
	'finishing-a-development-branch',
	'receiving-code-review',
	'requesting-code-review',
	'subagent-driven-development',
	'systematic-debugging',
	'test-driven-development',
	'using-git-worktrees',
	'using-superpowers',
	'verification-before-completion',
	'writing-plans',
	'writing-skills',
];

const OBSIDIAN_SKILLS = [
	'defuddle',
	'json-canvas',
	'obsidian-bases',
	'obsidian-cli',
	'obsidian-markdown',
];

const TRAILOFBITS_PATHS = [
	'plugins/agentic-actions-auditor/skills/agentic-actions-auditor',
	'plugins/ask-questions-if-underspecified/skills/ask-questions-if-underspecified',
	'plugins/audit-context-building/skills/audit-context-building',
	'plugins/building-secure-contracts/skills/algorand-vulnerability-scanner',
	'plugins/building-secure-contracts/skills/audit-prep-assistant',
	'plugins/building-secure-contracts/skills/cairo-vulnerability-scanner',
	'plugins/building-secure-contracts/skills/code-maturity-assessor',
	'plugins/building-secure-contracts/skills/cosmos-vulnerability-scanner',
	'plugins/building-secure-contracts/skills/guidelines-advisor',
	'plugins/building-secure-contracts/skills/secure-workflow-guide',
	'plugins/building-secure-contracts/skills/solana-vulnerability-scanner',
	'plugins/building-secure-contracts/skills/substrate-vulnerability-scanner',
	'plugins/building-secure-contracts/skills/token-integration-analyzer',
	'plugins/building-secure-contracts/skills/ton-vulnerability-scanner',
	'plugins/burpsuite-project-parser/skills/burpsuite-project-parser',
	'plugins/c-review/skills/c-review',
	'plugins/claude-in-chrome-troubleshooting/skills/chrome-mcp-troubleshooting',
	'plugins/constant-time-analysis/skills/constant-time-analysis',
	'plugins/culture-index/skills/interpreting-culture-index',
	'plugins/debug-buttercup/skills/debug-buttercup',
	'plugins/devcontainer-setup/skills/devcontainer-setup',
	'plugins/differential-review/skills/differential-review',
	'plugins/dimensional-analysis/skills/dimensional-analysis',
	'plugins/dwarf-expert/skills/dwarf-expert',
	'plugins/entry-point-analyzer/skills/entry-point-analyzer',
	'plugins/firebase-apk-scanner/skills/firebase-apk-scanner',
	'plugins/fp-check/skills/fp-check',
	'plugins/gh-cli/skills/gh-cli',
	'plugins/git-cleanup/skills/git-cleanup',
	'plugins/insecure-defaults/skills/insecure-defaults',
	'plugins/let-fate-decide/skills/let-fate-decide',
	'plugins/modern-python/skills/modern-python',
	'plugins/mutation-testing/skills/mutation-testing',
	'plugins/property-based-testing/skills/property-based-testing',
	'plugins/rust-review/skills/rust-review',
	'plugins/seatbelt-sandboxer/skills/seatbelt-sandboxer',
	'plugins/second-opinion/skills/second-opinion',
	'plugins/semgrep-rule-creator/skills/semgrep-rule-creator',
	'plugins/semgrep-rule-variant-creator/skills/semgrep-rule-variant-creator',
	'plugins/sharp-edges/skills/sharp-edges',
	'plugins/skill-improver/skills/skill-improver',
	'plugins/spec-to-code-compliance/skills/spec-to-code-compliance',
	'plugins/static-analysis/skills/codeql',
	'plugins/static-analysis/skills/sarif-parsing',
	'plugins/static-analysis/skills/semgrep',
	'plugins/supply-chain-risk-auditor/skills/supply-chain-risk-auditor',
	'plugins/testing-handbook-skills/skills/address-sanitizer',
	'plugins/testing-handbook-skills/skills/aflpp',
	'plugins/testing-handbook-skills/skills/atheris',
	'plugins/testing-handbook-skills/skills/cargo-fuzz',
	'plugins/testing-handbook-skills/skills/constant-time-testing',
	'plugins/testing-handbook-skills/skills/coverage-analysis',
	'plugins/testing-handbook-skills/skills/fuzzing-dictionary',
	'plugins/testing-handbook-skills/skills/fuzzing-obstacles',
	'plugins/testing-handbook-skills/skills/harness-writing',
	'plugins/testing-handbook-skills/skills/libafl',
	'plugins/testing-handbook-skills/skills/libfuzzer',
	'plugins/testing-handbook-skills/skills/ossfuzz',
	'plugins/testing-handbook-skills/skills/ruzzy',
	'plugins/testing-handbook-skills/skills/testing-handbook-generator',
	'plugins/testing-handbook-skills/skills/wycheproof',
	'plugins/trailmark/skills/audit-augmentation',
	'plugins/trailmark/skills/crypto-protocol-diagram',
	'plugins/trailmark/skills/diagramming-code',
	'plugins/trailmark/skills/genotoxic',
	'plugins/trailmark/skills/graph-evolution',
	'plugins/trailmark/skills/mermaid-to-proverif',
	'plugins/trailmark/skills/trailmark',
	'plugins/trailmark/skills/trailmark-structural',
	'plugins/trailmark/skills/trailmark-summary',
	'plugins/trailmark/skills/vector-forge',
	'plugins/variant-analysis/skills/variant-analysis',
	'plugins/workflow-skill-design/skills/designing-workflow-skills',
	'plugins/yara-authoring/skills/yara-rule-authoring',
	'plugins/zeroize-audit/skills/zeroize-audit',
];

// Wave 6 (curated 2026-07-28): popular, broad-appeal skills - viral singles
// plus official vendor packs. Large vendor collections are cherry-picked to
// their widely useful cores, not imported wholesale.
const PONYTAIL_SKILLS = [
	'ponytail',
	'ponytail-review',
	'ponytail-audit',
	'ponytail-debt',
	'ponytail-gain',
	'ponytail-help',
];

const VERCEL_SKILLS = [
	'react-best-practices',
	'web-design-guidelines',
	'deploy-to-vercel',
	'vercel-optimize',
];

const GOOGLE_WORKSPACE_SKILLS = [
	'gws-gmail',
	'gws-calendar',
	'gws-drive',
	'gws-docs',
	'gws-sheets',
	'gws-slides',
	'gws-chat',
	'gws-tasks',
];

const SUPABASE_SKILLS = ['supabase', 'supabase-postgres-best-practices'];

const CLOUDFLARE_SKILLS = [
	'cloudflare',
	'workers-best-practices',
	'wrangler',
	'durable-objects',
	'web-perf',
];

const EXPO_SKILLS = ['expo-router', 'expo-project-structure', 'expo-data-fetching', 'expo-upgrade'];

const skillsUnder = (repo: string, names: readonly string[], attributedTo: string) =>
	names.map((name) => ({
		githubUrl: `https://github.com/${repo}/tree/main/skills/${name}`,
		attributedTo,
	}));

export const SEED_LISTINGS: SeedListing[] = seedManifestSchema.parse([
	...ANTHROPIC_SKILLS.map((name) => ({
		githubUrl: `https://github.com/anthropics/skills/tree/main/skills/${name}`,
		attributedTo: 'anthropics',
		...(FEATURED.has(name) ? { featured: true } : {}),
	})),
	...skillsUnder('addyosmani/agent-skills', AGENT_SKILLS, 'addyosmani'),
	...skillsUnder('obra/superpowers', SUPERPOWERS_SKILLS, 'obra'),
	...skillsUnder('kepano/obsidian-skills', OBSIDIAN_SKILLS, 'kepano'),
	...TRAILOFBITS_PATHS.map((path) => ({
		githubUrl: `https://github.com/trailofbits/skills/tree/main/${path}`,
		attributedTo: 'trailofbits',
	})),
	{ githubUrl: 'https://github.com/blader/humanizer', attributedTo: 'blader', featured: true },
	{
		githubUrl: 'https://github.com/mvanhorn/last30days-skill/tree/main/skills/last30days',
		attributedTo: 'mvanhorn',
		featured: true,
	},
	...skillsUnder('DietrichGebert/ponytail', PONYTAIL_SKILLS, 'DietrichGebert').map((l) =>
		l.githubUrl.endsWith('/ponytail') ? { ...l, featured: true } : l,
	),
	{
		githubUrl:
			'https://github.com/OthmanAdi/planning-with-files/tree/master/skills/planning-with-files',
		attributedTo: 'OthmanAdi',
	},
	// op7418/guizang-ppt-skill was considered but its root skill bundles a >1MB
	// showcase image, which the snapshot pipeline rejects.
	{
		githubUrl: 'https://github.com/ayghri/i-have-adhd/tree/main/skills/i-have-adhd',
		attributedTo: 'ayghri',
	},
	...skillsUnder('vercel-labs/agent-skills', VERCEL_SKILLS, 'vercel-labs'),
	...skillsUnder('googleworkspace/cli', GOOGLE_WORKSPACE_SKILLS, 'googleworkspace'),
	...skillsUnder('makenotion/skills', ['notion-cli'], 'makenotion'),
	...skillsUnder('supabase/agent-skills', SUPABASE_SKILLS, 'supabase'),
	...skillsUnder('cloudflare/skills', CLOUDFLARE_SKILLS, 'cloudflare'),
	...EXPO_SKILLS.map((name) => ({
		githubUrl: `https://github.com/expo/skills/tree/main/plugins/expo/skills/${name}`,
		attributedTo: 'expo',
	})),
]);
