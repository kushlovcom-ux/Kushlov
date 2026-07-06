import { defineConfig } from 'tsup';

const shared = {
  format: ['esm'] as const,
  target: 'node20' as const,
  platform: 'node' as const,
  sourcemap: true,
  splitting: false,
  minify: false,
  noExternal: [/^@kushlov\//],
  external: ['ioredis', 'rate-limit-redis'],
};

/**
 * Bundle the API server:
 * - dist/index.js  → long-running Node server (Railway, Render, local)
 * - api/index.js   → self-contained Vercel serverless function (no dist/ import)
 */
export default defineConfig([
  {
    ...shared,
    entry: ['src/index.ts'],
    outDir: 'dist',
    clean: true,
  },
  {
    ...shared,
    entry: { index: 'vercel-entry.ts' },
    outDir: 'api',
    clean: true,
  },
]);
