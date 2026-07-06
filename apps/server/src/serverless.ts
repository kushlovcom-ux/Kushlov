import type { IncomingMessage, ServerResponse } from 'node:http';
import { connectDatabase } from './config/db';
import { createApp } from './app';
import { ensureSeed } from './seed';
import { logger } from './config/logger';

let app: ReturnType<typeof createApp> | null = null;
let ready: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  if (app) return;
  if (!ready) {
    ready = (async () => {
      await connectDatabase();
      await ensureSeed();
      app = createApp();
      logger.info('Kushlov API ready (Vercel serverless)');
    })();
  }
  await ready;
}

/** Vercel serverless entry — reuses one Express app across warm invocations. */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    await bootstrap();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any)(req, res);
  } catch (err) {
    logger.error({ err }, 'Serverless handler failed');
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          success: false,
          message: err instanceof Error ? err.message : 'Internal server error',
        }),
      );
    }
  }
}
