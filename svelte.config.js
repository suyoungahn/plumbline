import adapterStatic from '@sveltejs/adapter-static';
import adapterAuto from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const STATIC = process.env.ADAPTER === 'static';
const base = process.env.BASE_PATH ?? '';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: STATIC
      ? adapterStatic({ pages: 'build', assets: 'build', fallback: '404.html', precompress: false, strict: false })
      : adapterAuto(),
    paths: { base, relative: false },
    prerender: {
      entries: STATIC
        ? ['*', '/api/portfolio', '/api/reporting', '/api/jev-log', '/api/verify', '/api/plan-baseline']
        : []
    }
  }
};
