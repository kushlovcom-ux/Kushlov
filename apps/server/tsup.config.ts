import { defineConfig } from 'tsup';

/**
 * Bundle the long-running Node server only (Railway, Render, local).
 * Vercel uses api/index.ts — compiled by @vercel/node, not this bundle.
 */
export default defineConfig({
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  splitting: false,
  minify: false,
  noExternal: [/^@kushlov\//],
  external: ['ioredis', 'rate-limit-redis'],
  entry: ['src/index.ts'],
  outDir: 'dist',
  clean: true,
});
