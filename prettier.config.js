export default {
	useTabs: true,
	singleQuote: true,
	printWidth: 120,
	plugins: ['prettier-plugin-astro'],
	overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};
