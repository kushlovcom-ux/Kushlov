import { defineConfig } from 'tsup';

/**
 * Two outputs:
 * - dist/index.js → long-running ESM Node server (Railway, Render, local)
 * - api/index.js  → CommonJS bundle for the Vercel serverless function
 *
 * Workspace packages (@kushlov/*) are always inlined. Real node_modules stay
 * external so Vercel's file tracer includes them and native/dynamic-require
 * packages (mongoose, firebase-admin, etc.) work unmodified at runtime.
 */
export default defineConfig([
  {
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
  },
  {
    format: ['cjs'],
    target: 'node20',
    platform: 'node',
    sourcemap: false,
    splitting: false,
    minify: false,
    skipNodeModulesBundle: true,
    noExternal: [/^@kushlov\//],
    entry: { index: 'api-entry.ts' },
    outDir: 'api',
    outExtension: () => ({ js: '.js' }),
    clean: false,
  },
]);
