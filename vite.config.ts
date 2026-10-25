import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // Archived collections' results, which the site bundles (see archives.svelte.ts).
  server: { fs: { allow: ['archives'] } }
});
