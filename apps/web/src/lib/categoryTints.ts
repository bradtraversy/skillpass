import type { CategorySlug } from 'skill-schema';

// Static class strings so Tailwind's JIT sees them; tints stay soft enough
// that verdict color still reads as the loudest signal on the page.
export const TILE_TINTS: Record<CategorySlug, string> = {
	'security-review': 'border-rose-400/25 bg-rose-400/10 text-rose-300',
	fuzzing: 'border-orange-400/25 bg-orange-400/10 text-orange-300',
	blockchain: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
	cryptography: 'border-teal-400/25 bg-teal-400/10 text-teal-300',
	'code-analysis': 'border-sky-400/25 bg-sky-400/10 text-sky-300',
	testing: 'border-lime-400/25 bg-lime-400/10 text-lime-300',
	'agent-workflow': 'border-violet-400/25 bg-violet-400/10 text-violet-300',
	'dev-practices': 'border-indigo-400/25 bg-indigo-400/10 text-indigo-300',
	'docs-writing': 'border-amber-400/25 bg-amber-400/10 text-amber-300',
	'design-creative': 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300',
	'knowledge-notes': 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
	'dev-tooling': 'border-blue-400/25 bg-blue-400/10 text-blue-300',
};

// Same hue per category as the tiles, as a solid fill for legend swatches.
export const CATEGORY_SWATCHES: Record<CategorySlug, string> = {
	'security-review': 'bg-rose-400',
	fuzzing: 'bg-orange-400',
	blockchain: 'bg-cyan-400',
	cryptography: 'bg-teal-400',
	'code-analysis': 'bg-sky-400',
	testing: 'bg-lime-400',
	'agent-workflow': 'bg-violet-400',
	'dev-practices': 'bg-indigo-400',
	'docs-writing': 'bg-amber-400',
	'design-creative': 'bg-fuchsia-400',
	'knowledge-notes': 'bg-emerald-400',
	'dev-tooling': 'bg-blue-400',
};
