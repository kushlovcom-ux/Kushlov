import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { corsOrigins, env } from './config/env';
import { connectDatabase } from './config/db';
import { logger } from './config/logger';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFound } from './middleware/error';
import { apiRouter } from './routes';
import { ensureSeed } from './seed';

let vercelDbReady: Promise<void> | null = null;

/** Connect MongoDB + seed on first request when running as a Vercel serverless function. */
function vercelDbMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  if (!env.MONGODB_URI || !env.JWT_SECRET || env.JWT_SECRET === 'missing') {
    next(
      new Error(
        'Server misconfigured: set MONGODB_URI, JWT_SECRET, and JWT_REFRESH_SECRET in Vercel environment variables.',
      ),
    );
    return;
  }
  if (!vercelDbReady) {
    vercelDbReady = (async () => {
      await connectDatabase();
      await ensureSeed();
      logger.info('Kushlov API ready (Vercel)');
    })();
  }
  vercelDbReady.then(() => next()).catch(next);
}

/** Build and configure the Express application (no network binding here). */
export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  // Public probes — work even if MongoDB is unreachable (helps Vercel debugging).
  app.get('/health', (_req: Request, res: Response) =>
    res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } }),
  );

  app.get('/', (_req: Request, res: Response) =>
    res.json({
      success: true,
      data: {
        name: 'Kushlov API',
        version: '1.0.0',
        health: '/health',
        api: '/api',
      },
    }),
  );

  app.get('/favicon.ico', (_req: Request, res: Response) => res.status(204).end());

  if (process.env.VERCEL) {
    app.use(vercelDbMiddleware);
  }

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS with credentialed cookies
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
          return cb(null, true);
        }
        return cb(new Error(`Not allowed by CORS: ${origin}`));
      },
      credentials: true,
    }),
  );

  // Stripe-style webhooks need the raw body; capture it before json parsing.
  app.use('/api/payments/webhook', express.raw({ type: '*/*' }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // Rate limit + mount the API
  app.use('/api', globalLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
