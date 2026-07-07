/**
 * Source for the Vercel serverless function. tsup bundles this into
 * api/index.js (CommonJS) so Vercel runs a plain, dependency-traced JS file
 * with no TypeScript compilation or ESM dynamic-require issues.
 */
import { createApp } from './src/app';

const app = createApp();
export default app;
