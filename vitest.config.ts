import { defineConfig } from 'vitest/config';

// One config for the whole monorepo. Pure-logic units only (node env);
// Astro pages and React islands are verified with the build + a screenshot,
// not unit tests. See blueprint/context/coding-standards.md.
export default defineConfig({
	test: {
		include: ['apps/**/*.{test,spec}.{ts,tsx}', 'packages/**/*.{test,spec}.{ts,tsx}'],
	},
});
