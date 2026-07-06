import { defineConfig } from 'tsup';

/**
 * Bundle the API server into a single ESM file so runtime module resolution
 * (workspace packages, extensionless imports) is handled at build time.
 */
export default defineConfig({
  entry: ['src/index.ts', 'src/serverless.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  minify: false,
  // Bundle the workspace packages (they ship .ts source and have no build step).
  noExternal: [/^@kushlov\//],
  // These are optional native/peer deps; keep them external so bundling never fails.
  external: ['ioredis', 'rate-limit-redis'],
});
