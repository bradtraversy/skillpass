// @ts-check
import { defineConfig } from 'astro/config';

import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Static by default; individual routes opt into on-demand rendering with
// `export const prerender = false` (the per-entity skill/profile pages).
// https://astro.build/config
export default defineConfig({
	site: 'https://skillpass.dev',
	adapter: node({ mode: 'standalone' }),
	integrations: [react()],
	vite: {
		plugins: [tailwindcss()],
	},
});
