import { z } from 'zod';

export const seedListingSchema = z.object({
	githubUrl: z.url(),
	attributedTo: z.string().min(1),
	// Overrides the inferred listing name (and slug) when the source folder's
	// own name is too generic to own globally (e.g. "sales", "data").
	name: z.string().min(1).optional(),
	// Curated card title; wins over the generated display copy, which would
	// otherwise title-case the slug (knowledge-work-sales -> "Knowledge Work Sales").
	displayName: z.string().min(1).optional(),
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

const OBSIDIAN_SKILLS = ['defuddle', 'json-canvas', 'obsidian-bases', 'obsidian-cli', 'obsidian-markdown'];

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

const VERCEL_SKILLS = ['react-best-practices', 'web-design-guidelines', 'deploy-to-vercel', 'vercel-optimize'];

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

const CLOUDFLARE_SKILLS = ['cloudflare', 'workers-best-practices', 'wrangler', 'durable-objects', 'web-perf'];

const EXPO_SKILLS = ['expo-router', 'expo-project-structure', 'expo-data-fetching', 'expo-upgrade'];

// Wave 7 (curated 2026-07-28): big-name community skills plus the official AWS
// pack; marketing/SEO picks are the first non-dev-audience content.
const MATTPOCOCK_SKILLS = ['code-review', 'diagnosing-bugs', 'domain-modeling', 'prototype', 'tdd'];

const MARKETING_SKILLS = [
	'copywriting',
	'cro',
	'seo-audit',
	'content-strategy',
	'analytics',
	'pricing',
	'launch',
	'emails',
];

const AWS_SKILLS = ['aws-cdk', 'aws-serverless', 'aws-iam', 'aws-database', 'aws-deployment', 'amazon-bedrock'];

// Wave 8 (curated 2026-08-03): the official Anthropic knowledge-work plugins,
// one cohesive per-role workflow pack per plugin subpath - skills designed to
// chain into each other (routers, shared CONNECTORS.md, non-invocable support
// skills). Excluded: pdf-viewer (a single skill), cowork-plugin-management
// (plugin-authoring meta), productivity (Cowork session plumbing). Each entry
// carries a knowledge-work-* name override so one vendor's packs don't claim
// generic global slugs like "sales" or "data".
const KNOWLEDGE_WORK_PACKS = [
	'bio-research',
	'customer-support',
	'data',
	'design',
	'engineering',
	'enterprise-search',
	'finance',
	'human-resources',
	'legal',
	'marketing',
	'operations',
	'product-management',
	'sales',
	'small-business',
];

// Wave 9 (curated 2026-08-03): official vendor cherry-picks - the widely useful
// core of each org's catalog per the wave-6 rule, never wholesale imports - plus
// two cohesive vendor plugin packs (Stripe, Neon). Sourced from a skillrepo.dev
// competitive sweep; the sprawling catalogs (google's 99, MicrosoftDocs' 191)
// deliberately stay unlisted beyond these picks.
const GOOGLE_CLOUD_SKILLS = [
	'gemini-api',
	'gemini-agents-api',
	'gcloud',
	'cloud-run-basics',
	'bigquery-basics',
	'firebase-basics',
];

const FLUTTER_SKILLS = [
	'flutter-apply-architecture-best-practices',
	'flutter-add-widget-test',
	'flutter-build-responsive-layout',
	'flutter-setup-declarative-routing',
	'flutter-implement-json-serialization',
];

const SENTRY_SKILLS = ['security-review', 'find-bugs', 'skill-scanner', 'prompt-optimizer', 'code-simplifier'];

const HUGGINGFACE_SKILLS = [
	'huggingface-datasets',
	'huggingface-local-models',
	'transformers-js',
	'huggingface-spaces',
	'huggingface-llm-trainer',
];

const OPENAI_SKILLS = ['chatgpt-apps', 'playwright', 'figma-implement-design', 'security-threat-model', 'cli-creator'];

const AZURE_SKILLS = [
	'azure-app-service',
	'azure-container-apps',
	'azure-blob-storage',
	'azure-functions',
	'azure-cosmos-db',
];

const skillsUnder = (repo: string, names: readonly string[], attributedTo: string) =>
	names.map((name) => ({
		githubUrl: `https://github.com/${repo}/tree/main/skills/${name}`,
		attributedTo,
	}));

// Wave 10 (curated 2026-09-29): the skills.sh leaderboard - every skill above
// 50k installs whose folder still exists upstream, listed as singles under the
// repo owner. Dropped on the way in: zero-star copies of superpowers, skills
// hosted off GitHub, and the one repo whose README says proprietary. Left out
// after the dev seed run: heygen-com/hyperframes and stablyai/orca (repo
// archives exceed the 100 MB download budget; a subtree fetch would admit
// them), pbakaus/impeccable (bundles a >1 MB asset), tt-a1i/archify (package
// over 10 MB), and mattpocock resolving-merge-conflicts (removed upstream).
// Entries are [repo, default branch, skill folders]; an empty folder is the
// repo root.
const WAVE_10: readonly (readonly [string, string, readonly string[]])[] = [
	[
		'coreyhaines31/marketingskills',
		'main',
		[
			'skills/marketing-psychology',
			'skills/programmatic-seo',
			'skills/marketing-ideas',
			'skills/ai-seo',
			'skills/copy-editing',
			'skills/ad-creative',
			'skills/cold-email',
			'skills/site-architecture',
			'skills/churn-prevention',
			'skills/sales-enablement',
			'skills/revops',
			'skills/lead-magnets',
			'skills/competitor-profiling',
			'skills/community-marketing',
			'skills/image',
			'skills/video',
			'skills/directory-submissions',
			'skills/product-marketing',
			'skills/social',
			'skills/co-marketing',
			'skills/ads',
			'skills/competitors',
			'skills/schema',
			'skills/ab-testing',
			'skills/aso',
			'skills/free-tools',
			'skills/signup',
			'skills/referrals',
			'skills/popups',
			'skills/paywalls',
			'skills/marketing-plan',
			'skills/sms',
			'skills/prospecting',
		],
	],
	[
		'mattpocock/skills',
		'main',
		[
			'skills/productivity/grill-me',
			'skills/engineering/grill-with-docs',
			'skills/engineering/improve-codebase-architecture',
			'skills/engineering/setup-matt-pocock-skills',
			'skills/productivity/handoff',
			'skills/engineering/triage',
			'skills/productivity/grilling',
			'skills/productivity/teach',
			'skills/engineering/codebase-design',
			'skills/engineering/ask-matt',
			'skills/engineering/wayfinder',
			'skills/engineering/to-spec',
			'skills/engineering/research',
			'skills/engineering/to-tickets',
			'skills/engineering/wizard',
			'skills/misc/git-guardrails-claude-code',
			'skills/misc/setup-pre-commit',
			'skills/in-progress/writing-beats',
			'skills/in-progress/writing-shape',
			'skills/misc/scaffold-exercises',
			'skills/in-progress/writing-fragments',
			'skills/misc/migrate-to-shoehorn',
			'skills/productivity/to-questionnaire',
			'skills/in-progress/loop-me',
			'skills/productivity/writing-for-agents',
			'skills/in-progress/claude-handoff',
			'skills/productivity/wait-what',
			'skills/in-progress/setup-ts-deep-modules',
			'skills/engineering/implement-spec',
			'skills/engineering/retro',
		],
	],
	[
		'prime-skills/runcomfy-agent-skills',
		'main',
		[
			'video-edit',
			'image-to-video',
			'nano-banana-2',
			'image-edit',
			'nano-banana-edit',
			'flux-kontext',
			'wan-2-7',
			'gpt-image-edit',
			'seedance-v2',
			'happyhorse-1-0',
			'flux-2-klein',
			'kling-3-0',
			'codex-pet',
			'ai-video-generation',
			'ai-image-generation',
			'runcomfy-cli',
			'ai-avatar-video',
			'face-swap',
			'video-inpainting',
			'image-inpainting',
			'controlnet-pose',
			'lipsync',
			'video-extend',
			'elevenlabs-music-generation',
			'image-outpainting',
			'relight',
			'video-outpainting',
			'ai-music',
			'ace-step',
			'gpt-image-2',
		],
	],
	[
		'microsoft/azure-skills',
		'main',
		[
			'.github/plugins/azure-skills/skills/microsoft-foundry',
			'.github/plugins/azure-skills/skills/azure-diagnostics',
			'.github/plugins/azure-skills/skills/azure-prepare',
			'.github/plugins/azure-skills/skills/azure-ai',
			'.github/plugins/azure-skills/skills/azure-deploy',
			'.github/plugins/azure-skills/skills/azure-validate',
			'.github/plugins/azure-skills/skills/azure-storage',
			'.github/plugins/azure-skills/skills/entra-app-registration',
			'.github/plugins/azure-skills/skills/azure-compliance',
			'.github/plugins/azure-skills/skills/appinsights-instrumentation',
			'.github/plugins/azure-skills/skills/azure-resource-lookup',
			'.github/plugins/azure-skills/skills/azure-resource-visualizer',
			'.github/plugins/azure-skills/skills/azure-aigateway',
			'.github/plugins/azure-skills/skills/azure-kusto',
			'.github/plugins/azure-skills/skills/azure-messaging',
			'.github/plugins/azure-skills/skills/azure-compute',
			'.github/plugins/azure-skills/skills/azure-cloud-migrate',
			'.github/plugins/azure-skills/skills/azure-quotas',
			'.github/plugins/azure-skills/skills/azure-upgrade',
			'.github/plugins/azure-skills/skills/azure-enterprise-infra-planner',
			'.github/plugins/azure-skills/skills/azure-kubernetes',
			'.github/plugins/azure-skills/skills/airunway-aks-setup',
			'.github/plugins/azure-skills/skills/entra-agent-id',
			'.github/plugins/azure-skills/skills/azure-reliability',
			'.github/plugins/azure-skills/skills/python-appservice-deploy',
			'.github/plugins/azure-cost/skills/cost-optimization',
			'.github/plugins/azure-skills/skills/azure-app-onboard',
			'.github/plugins/azure-skills/skills/azure-app-onboard-prereq',
		],
	],
	[
		'larksuite/cli',
		'main',
		[
			'skills/lark-doc',
			'skills/lark-base',
			'skills/lark-shared',
			'skills/lark-im',
			'skills/lark-drive',
			'skills/lark-sheets',
			'skills/lark-wiki',
			'skills/lark-whiteboard',
			'skills/lark-task',
			'skills/lark-calendar',
			'skills/lark-mail',
			'skills/lark-minutes',
			'skills/lark-vc',
			'skills/lark-event',
			'skills/lark-contact',
			'skills/lark-workflow-meeting-summary',
			'skills/lark-workflow-standup-report',
			'skills/lark-openapi-explorer',
			'skills/lark-skill-maker',
			'skills/lark-approval',
			'skills/lark-slides',
			'skills/lark-attendance',
			'skills/lark-okr',
			'skills/lark-markdown',
			'skills/lark-vc-agent',
			'skills/lark-apps',
			'skills/lark-note',
		],
	],
	[
		'JuliusBrussee/caveman',
		'main',
		[
			'plugins/caveman/skills/caveman',
			'skills/caveman-commit',
			'skills/caveman-review',
			'plugins/caveman/skills/caveman-compress',
			'skills/caveman-help',
			'plugins/caveman/skills/cavecrew',
			'plugins/caveman/skills/caveman-stats',
			'skills/caveman-explore',
			'skills/caveman-optimize',
			'skills/caveman-learn',
			'skills/safe-refactor',
			'skills/investigate-first',
			'skills/verify-and-stop',
			'skills/surgical-patch',
			'skills/caveman-evidence-review',
			'skills/caveman-discover',
			'skills/lean-build',
			'skills/caveman-manage',
			'skills/migration',
			'skills/caveman-setup',
		],
	],
	[
		'remotion-dev/skills',
		'main',
		[
			'skills/remotion-best-practices',
			'skills/remotion-render',
			'skills/remotion-create',
			'skills/remotion-captions',
			'skills/remotion-markup',
			'skills/remotion-interactivity',
			'skills/remotion-saas',
			'skills/remotion-docs',
			'skills/remotion-upgrade',
			'skills/remotion-multimedia',
			'skills/remotion-maps',
			'skills/remotion-studio',
		],
	],
	[
		'emilkowalski/skills',
		'main',
		[
			'skills/emil-design-eng',
			'skills/review-animations',
			'skills/animation-vocabulary',
			'skills/apple-design',
			'skills/improve-animations',
			'skills/find-animation-opportunities',
			'skills/pick-ui-library',
			'skills/animate',
			'skills/ask-sonner',
			'skills/animate-expo',
			'skills/write-swift',
		],
	],
	[
		'Leonxlnx/taste-skill',
		'main',
		[
			'skills/redesign-skill',
			'skills/minimalist-skill',
			'skills/output-skill',
			'skills/gpt-tasteskill',
			'skills/brutalist-skill',
			'skills/stitch-skill',
			'skills/brandkit',
			'skills/image-to-code-skill',
			'skills/imagegen-frontend-web',
			'skills/imagegen-frontend-mobile',
			'skills/taste-skill-v1',
		],
	],
	[
		'lllllllama/RigorPilot-Skills',
		'main',
		[
			'skills/paper-context-resolver',
			'skills/repo-intake-and-plan',
			'skills/minimal-run-and-audit',
			'skills/env-and-assets-bootstrap',
			'skills/ai-research-explore',
			'skills/analyze-project',
			'skills/ai-research-reproduction',
			'skills/explore-code',
			'skills/safe-debug',
			'skills/run-train',
			'skills/explore-run',
		],
	],
	[
		'firebase/agent-skills',
		'main',
		[
			'skills/firebase-auth-basics',
			'skills/firebase-hosting-basics',
			'skills/firebase-app-hosting-basics',
			'skills/firebase-security-rules-auditor',
			'skills/firebase-ai-logic-basics',
			'skills/firebase-firestore',
			'skills/firebase-crashlytics',
			'skills/xcode-project-setup',
			'skills/firebase-remote-config-basics',
		],
	],
	[
		'prisma/skills',
		'main',
		[
			'prisma-database-setup',
			'prisma-client-api',
			'prisma-cli',
			'prisma-postgres',
			'prisma-driver-adapter-implementation',
			'prisma-upgrade-v7',
			'prisma-postgres-setup',
			'prisma-compute',
			'prisma-mongodb-upgrade',
		],
	],
	[
		'firecrawl/cli',
		'main',
		[
			'skills/firecrawl',
			'skills/firecrawl-search',
			'skills/firecrawl-scrape',
			'skills/firecrawl-agent',
			'skills/firecrawl-crawl',
			'skills/firecrawl-map',
			'skills/firecrawl-download',
			'skills/firecrawl-interact',
		],
	],
	[
		'genmedia-labs/skills',
		'main',
		[
			'video-edit',
			'ai-music',
			'ai-video-generation',
			'image-to-video',
			'ai-image-generation',
			'wan-3-0-prime-reference-to-video',
			'seedance-2-5-image-to-video',
			'seedance-2-5-reference-to-video',
		],
	],
	[
		'higgsfield-ai/skills',
		'main',
		[
			'higgsfield-generate',
			'higgsfield-product-photoshoot',
			'higgsfield-soul-id',
			'higgsfield-marketplace-cards',
			'higgsfield-websites',
			'higgsfield-video-explainer',
			'higgsfield-brandkit',
			'higgsfield-youtube-thumbnail',
		],
	],
	[
		'google/agents-cli',
		'main',
		[
			'skills/google-agents-cli-adk-code',
			'skills/google-agents-cli-workflow',
			'skills/google-agents-cli-eval',
			'skills/google-agents-cli-deploy',
			'skills/google-agents-cli-scaffold',
			'skills/google-agents-cli-observability',
			'skills/google-agents-cli-publish',
		],
	],
	[
		'greensock/gsap-skills',
		'main',
		[
			'skills/gsap-core',
			'skills/gsap-scrolltrigger',
			'skills/gsap-performance',
			'skills/gsap-timeline',
			'skills/gsap-plugins',
			'skills/gsap-react',
			'skills/gsap-utils',
		],
	],
	[
		'autonnel/autonnel-skills',
		'main',
		[
			'landing-page-conversion-audit',
			'sales-funnel-blueprint',
			'server-side-conversion-tracking',
			'funnel-platform-picker',
			'post-purchase-upsell-flow',
			'self-hosted-funnel-launch',
		],
	],
	[
		'cloudflare/skills',
		'main',
		[
			'skills/agents-sdk',
			'skills/cloudflare-email-service',
			'skills/turnstile-spin',
			'skills/cloudflare-one',
			'skills/cloudflare-one-migrations',
		],
	],
	[
		'vercel-labs/agent-skills',
		'main',
		[
			'skills/composition-patterns',
			'skills/react-native-skills',
			'skills/react-view-transitions',
			'skills/vercel-cli-with-tokens',
			'skills/writing-guidelines',
		],
	],
	[
		'firecrawl/skills',
		'main',
		[
			'skills/build/firecrawl-build-scrape',
			'skills/build/firecrawl-build-search',
			'skills/build/firecrawl-build-interact',
			'skills/build/firecrawl-build-onboarding',
		],
	],
	[
		'liarjsdev/liarjs-skills',
		'main',
		[
			'skills/browser-fingerprint-audit',
			'skills/playwright-stealth-verify',
			'skills/fingerprint-ci-gate',
			'skills/fingerprint-failure-triage',
		],
	],
	[
		'UseOSINT/Skills',
		'main',
		[
			'skills/is-this-photo-real',
			'skills/investigate-without-getting-made',
			'skills/what-leaked-about-you',
			'skills/find-the-original-image',
		],
	],
	[
		'antibrow/anti-detect-browser-skills',
		'master',
		['anti-detect-browser', 'browser-mcp-agent', 'multi-account-isolation'],
	],
	['get-convex/agent-skills', 'main', ['skills/convex-quickstart', 'skills/convex-create-component', 'skills/convex']],
	[
		'google-labs-code/stitch-skills',
		'main',
		[
			'plugins/stitch-utilities/skills/design-md',
			'plugins/stitch-utilities/skills/enhance-prompt',
			'plugins/stitch-utilities/skills/stitch-loop',
		],
	],
	['googleworkspace/cli', 'main', ['skills/gws-gmail-send', 'skills/gws-shared']],
	['momentic-ai/skills', 'main', ['skills/momentic-test', 'skills/momentic-result-classification']],
	[
		'wshobson/agents',
		'main',
		[
			'plugins/javascript-typescript/skills/typescript-advanced-types',
			'plugins/frontend-mobile-development/skills/tailwind-design-system',
		],
	],
	['2dmurali/review-loop-skill', 'main', ['review-loop']],
	['addyosmani/web-quality-skills', 'main', ['skills/accessibility']],
	['agentix-cloud/skills', 'main', ['skills/agentix-ceo']],
	['arvindrk/extract-design-system', 'main', ['skills/extract-design-system']],
	['better-auth/skills', 'main', ['better-auth/best-practices']],
	['browser-act/skills', 'main', ['browser-act-skill-forge']],
	['browser-use/browser-use', 'main', ['browser_use/skills/browser-use']],
	['currents-dev/playwright-best-practices-skill', 'main', ['playwright-best-practices']],
	['designed-by-ai/skills', 'main', ['skills/design-mobile-apps']],
	['expo/skills', 'main', ['plugins/expo/skills/expo-dev-client']],
	['flowkit-labs/skills', 'main', ['reddit-automation']],
	['genkit-ai/skills', 'main', ['skills/developing-genkit-js']],
	['herdrdev/herdr', 'master', ['skills/herdr']],
	['intellectronica/agent-skills', 'main', ['skills/notion-api']],
	['jakubkrehel/make-interfaces-feel-better', 'main', ['skills/make-interfaces-feel-better']],
	['mastra-ai/skills', 'main', ['skills/mastra']],
	['mcollina/skills', 'main', ['skills/fastify']],
	['microsoft/playwright-cli', 'main', ['skills/playwright-cli']],
	['msmps/opentui-skill', 'main', ['skill/opentui']],
	['nexscope-ai/Amazon-Skills', 'main', ['amazon-product-research']],
	['nexscope-ai/eCommerce-Skills', 'main', ['cross-border-ecommerce']],
	['nozomio-labs/nia-skill', 'master', ['']],
	['nrwl/nx-ai-agents-config', 'main', ['artifacts/skills/nx-workspace']],
	['Nutlope/hallmark', 'main', ['skills/hallmark']],
	['ScrapeGraphAI/just-scrape', 'main', ['skills/just-scrape']],
	['shadcn-ui/ui', 'main', ['skills/shadcn']],
	['solana-foundation/solana-dev-skill', 'main', ['skills/solana-dev']],
	['SpillwaveSolutions/design-doc-mermaid', 'main', ['']],
	['squirrelscan/skills', 'main', ['skills/audit-website']],
	['typesafe-ai/skills', 'main', ['skills/typesafe-ai']],
	['vercel-labs/agent-browser', 'main', ['skills/agent-browser']],
	['vercel-labs/skills', 'main', ['skills/find-skills']],
	['vercel/ai', 'main', ['skills/use-ai-sdk']],
	['vercel/turborepo', 'main', ['skills/turborepo']],
	['Wind-Alice/AliceMarket', 'main', ['skills/wind-mcp-skill']],
];

// Five runcomfy names collide with genmedia-labs names inside the wave; the
// lower-installed side carries the repo-prefixed name.
const WAVE_10_NAMES: Record<string, string> = {
	'https://github.com/prime-skills/runcomfy-agent-skills/tree/main/video-edit': 'runcomfy-video-edit',
	'https://github.com/prime-skills/runcomfy-agent-skills/tree/main/image-to-video': 'runcomfy-image-to-video',
	'https://github.com/prime-skills/runcomfy-agent-skills/tree/main/ai-video-generation': 'runcomfy-ai-video-generation',
	'https://github.com/prime-skills/runcomfy-agent-skills/tree/main/ai-image-generation': 'runcomfy-ai-image-generation',
	'https://github.com/prime-skills/runcomfy-agent-skills/tree/main/ai-music': 'runcomfy-ai-music',
};

const wave10 = () =>
	WAVE_10.flatMap(([repo, branch, paths]) =>
		paths.map((path) => {
			const githubUrl = path ? `https://github.com/${repo}/tree/${branch}/${path}` : `https://github.com/${repo}`;
			const name = WAVE_10_NAMES[githubUrl];
			return { githubUrl, attributedTo: repo.split('/')[0], ...(name ? { name } : {}) };
		}),
	);

export const SEED_LISTINGS: SeedListing[] = seedManifestSchema.parse([
	...skillsUnder('anthropics/skills', ANTHROPIC_SKILLS, 'anthropics'),
	...skillsUnder('addyosmani/agent-skills', AGENT_SKILLS, 'addyosmani'),
	...skillsUnder('obra/superpowers', SUPERPOWERS_SKILLS, 'obra'),
	...skillsUnder('kepano/obsidian-skills', OBSIDIAN_SKILLS, 'kepano'),
	...TRAILOFBITS_PATHS.map((path) => ({
		githubUrl: `https://github.com/trailofbits/skills/tree/main/${path}`,
		attributedTo: 'trailofbits',
	})),
	{ githubUrl: 'https://github.com/blader/humanizer', attributedTo: 'blader' },
	{
		githubUrl: 'https://github.com/mvanhorn/last30days-skill/tree/main/skills/last30days',
		attributedTo: 'mvanhorn',
	},
	...skillsUnder('DietrichGebert/ponytail', PONYTAIL_SKILLS, 'DietrichGebert'),
	{
		githubUrl: 'https://github.com/OthmanAdi/planning-with-files/tree/master/skills/planning-with-files',
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
	...MATTPOCOCK_SKILLS.map((name) => ({
		githubUrl: `https://github.com/mattpocock/skills/tree/main/skills/engineering/${name}`,
		attributedTo: 'mattpocock',
	})),
	{
		githubUrl: 'https://github.com/multica-ai/andrej-karpathy-skills/tree/main/skills/karpathy-guidelines',
		attributedTo: 'multica-ai',
	},
	{
		githubUrl: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max',
		attributedTo: 'nextlevelbuilder',
	},
	{
		githubUrl: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/design-system',
		attributedTo: 'nextlevelbuilder',
	},
	{
		githubUrl: 'https://github.com/Leonxlnx/taste-skill/tree/main/skills/taste-skill',
		attributedTo: 'Leonxlnx',
	},
	...skillsUnder('coreyhaines31/marketingskills', MARKETING_SKILLS, 'coreyhaines31'),
	{ githubUrl: 'https://github.com/AgriciDaniel/claude-seo/tree/main/skills/seo', attributedTo: 'AgriciDaniel' },
	{
		githubUrl: 'https://github.com/SawyerHood/dev-browser/tree/main/skills/dev-browser',
		attributedTo: 'SawyerHood',
	},
	{
		githubUrl: 'https://github.com/browser-act/skills/tree/main/browser-act',
		attributedTo: 'browser-act',
	},
	...AWS_SKILLS.map((name) => ({
		githubUrl: `https://github.com/aws/agent-toolkit-for-aws/tree/main/skills/core-skills/${name}`,
		attributedTo: 'aws',
	})),
	...KNOWLEDGE_WORK_PACKS.map((plugin) => ({
		githubUrl: `https://github.com/anthropics/knowledge-work-plugins/tree/main/${plugin}`,
		attributedTo: 'anthropics',
		name: `knowledge-work-${plugin}`,
		displayName: `${plugin
			.split('-')
			.map((w) => w[0].toUpperCase() + w.slice(1))
			.join(' ')} Pack`,
	})),
	...GOOGLE_CLOUD_SKILLS.map((name) => ({
		githubUrl: `https://github.com/google/skills/tree/main/skills/cloud/${name}`,
		attributedTo: 'google',
	})),
	...skillsUnder('flutter/skills', FLUTTER_SKILLS, 'flutter'),
	...skillsUnder('getsentry/skills', SENTRY_SKILLS, 'getsentry'),
	...skillsUnder('huggingface/skills', HUGGINGFACE_SKILLS, 'huggingface'),
	...OPENAI_SKILLS.map((name) => ({
		githubUrl: `https://github.com/openai/skills/tree/main/skills/.curated/${name}`,
		attributedTo: 'openai',
	})),
	...skillsUnder('MicrosoftDocs/Agent-Skills', AZURE_SKILLS, 'MicrosoftDocs'),
	{
		githubUrl: 'https://github.com/stripe/agent-toolkit/tree/main/providers/claude/plugin',
		attributedTo: 'stripe',
		name: 'stripe-agent-toolkit',
		displayName: 'Stripe Pack',
	},
	{
		githubUrl: 'https://github.com/neondatabase/agent-skills/tree/main/plugins/neon-postgres',
		attributedTo: 'neondatabase',
		displayName: 'Neon Postgres Pack',
	},
	// Owner picks: Brad's maintainer-submitted packs. Both are already published
	// via the submit flow, so these entries normally just no-op on the skip path.
	// The editorial pack's name override matches its live slug (named at
	// submission from a zip filename, not the repo).
	{
		githubUrl: 'https://github.com/bradtraversy/ai-blueprint',
		attributedTo: 'bradtraversy',
	},
	{
		githubUrl: 'https://github.com/bradtraversy/editorial-workflow',
		attributedTo: 'bradtraversy',
		name: 'editorial-workflow-skill',
	},
	...wave10(),
]);

// The Featured tab roster, in curated rank order (index + 1 = featuredRank).
// Keyed by published slug, not source URL, so submit-flow listings (Brad's
// packs) rank the same way as seeded ones. Applied by the seed runner after
// the listing pass; a slug with no published skill is reported, not silently
// skipped.
export const FEATURED_SLUGS = [
	'ai-blueprint',
	'editorial-workflow-skill',
	'skill-creator',
	'pdf',
	'mcp-builder',
	'frontend-design',
	'humanizer',
	'ui-ux-pro-max',
	'last30days',
	'ponytail',
	'systematic-debugging',
	'vercel-react-best-practices',
	'web-design-guidelines',
	'security-review',
	'tdd',
	'code-review-and-quality',
	'dev-browser',
	'obsidian-markdown',
	'seo-audit',
	'stripe-agent-toolkit',
];
