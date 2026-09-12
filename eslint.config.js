import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['**/dist/', '**/.astro/', 'apps/api/drizzle/', 'blueprint/', '.claude/', '.agents/'] },
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			globals: { ...globals.node, ...globals.browser },
			parserOptions: {
				projectService: { allowDefaultProject: ['vitest.config.ts', 'apps/api/drizzle.config.ts'] },
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
			],
			// React event handlers are async on purpose; useAction and the callers own their rejections.
			'@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
			// An async function with no await still satisfies a Promise-returning contract.
			'@typescript-eslint/require-await': 'off',
		},
	},
	{
		files: ['**/*.tsx'],
		...reactHooks.configs.flat.recommended,
		rules: {
			...reactHooks.configs.flat.recommended.rules,
			// Hydration-safe localStorage reads and reset-on-filter-change are deliberate here.
			'react-hooks/set-state-in-effect': 'off',
		},
	},
	{
		files: ['**/*.test.ts', '**/*.test.tsx'],
		// vi.fn mocks are any-typed, and fetch stubs receive string URLs.
		rules: {
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-base-to-string': 'off',
		},
	},
	...astro.configs.recommended,
	{ files: ['**/*.js', '**/*.astro'], ...tseslint.configs.disableTypeChecked },
);
