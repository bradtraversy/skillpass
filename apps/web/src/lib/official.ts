import type { PublicSkillSummary } from 'skill-schema';

export interface OfficialOwner {
	login: string;
	name: string;
}

export interface OfficialGroup extends OfficialOwner {
	count: number;
}

// GitHub orgs whose own product the listed skills teach. `verified` alone cannot
// define "official" because the seed sets it on every curated listing.
export const OFFICIAL_OWNERS: readonly OfficialOwner[] = [
	{ login: 'anthropics', name: 'Anthropic' },
	{ login: 'google', name: 'Google' },
	{ login: 'googleworkspace', name: 'Google Workspace' },
	{ login: 'google-labs-code', name: 'Google Labs' },
	{ login: 'firebase', name: 'Firebase' },
	{ login: 'flutter', name: 'Flutter' },
	{ login: 'genkit-ai', name: 'Genkit' },
	{ login: 'microsoft', name: 'Microsoft' },
	{ login: 'MicrosoftDocs', name: 'Microsoft Docs' },
	{ login: 'larksuite', name: 'Lark' },
	{ login: 'cloudflare', name: 'Cloudflare' },
	{ login: 'vercel-labs', name: 'Vercel Labs' },
	{ login: 'vercel', name: 'Vercel' },
	{ login: 'prisma', name: 'Prisma' },
	{ login: 'firecrawl', name: 'Firecrawl' },
	{ login: 'remotion-dev', name: 'Remotion' },
	{ login: 'greensock', name: 'GSAP' },
	{ login: 'aws', name: 'AWS' },
	{ login: 'getsentry', name: 'Sentry' },
	{ login: 'expo', name: 'Expo' },
	{ login: 'openai', name: 'OpenAI' },
	{ login: 'huggingface', name: 'Hugging Face' },
	{ login: 'get-convex', name: 'Convex' },
	{ login: 'supabase', name: 'Supabase' },
	{ login: 'stripe', name: 'Stripe' },
	{ login: 'neondatabase', name: 'Neon' },
	{ login: 'shadcn-ui', name: 'shadcn/ui' },
	{ login: 'mastra-ai', name: 'Mastra' },
	{ login: 'nrwl', name: 'Nx' },
	{ login: 'better-auth', name: 'Better Auth' },
	{ login: 'browser-use', name: 'Browser Use' },
	{ login: 'makenotion', name: 'Notion' },
	{ login: 'solana-foundation', name: 'Solana Foundation' },
	{ login: 'higgsfield-ai', name: 'Higgsfield' },
	{ login: 'momentic-ai', name: 'Momentic' },
	{ login: 'ScrapeGraphAI', name: 'ScrapeGraphAI' },
];

// Same owner expression as the row's "by" line, so the page agrees with what
// rows already display.
const ownerOf = (skill: PublicSkillSummary) => (skill.attributedTo ?? skill.maintainer).toLowerCase();

export function groupOfficial(skills: readonly PublicSkillSummary[]): OfficialGroup[] {
	const byLogin = new Map<string, OfficialGroup>();
	for (const owner of OFFICIAL_OWNERS) byLogin.set(owner.login.toLowerCase(), { ...owner, count: 0 });

	for (const skill of skills) {
		if (!skill.verified) continue;
		const group = byLogin.get(ownerOf(skill));
		if (group) group.count += 1;
	}

	return [...byLogin.values()]
		.filter((group) => group.count > 0)
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'));
}
