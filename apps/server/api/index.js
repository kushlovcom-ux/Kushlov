// Committed Vercel serverless entry (CommonJS). Vercel auto-detects this file
// as a Serverless Function. It loads the pre-built CJS bundle produced by tsup
// (`pnpm --filter @kushlov/server build` → dist-vercel/index.cjs), so Vercel
// never compiles our TypeScript/ESM app directly.
const mod = require('../dist-vercel/index.cjs');

module.exports = mod && mod.default ? mod.default : mod;
