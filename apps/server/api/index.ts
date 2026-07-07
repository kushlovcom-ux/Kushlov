/**
 * Vercel serverless entry — compiled by @vercel/node (do not pre-bundle).
 * Exporting the Express app directly is the supported Vercel + Express pattern.
 */
import { createApp } from '../src/app';

const app = createApp();
export default app;
