import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { isOriginAllowed } from './config/cors';
import { env } from './config/env';
import { connectDatabase } from './config/db';
import { logger } from './config/logger';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFound } from './middleware/error';
import { apiRouter } from './routes';
import { ensureSeed } from './seed';

let vercelDbReady: Promise<void> | null = null;

/** Connect MongoDB + seed on first request when running as a Vercel serverless function. */
function vercelDbMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Preflight must succeed before DB — CORS middleware runs earlier.
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
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

  app.get('/', (req: Request, res: Response) => {
    const wantsHtml = req.headers.accept?.includes('text/html');
    const frontend = env.CLIENT_URL?.replace(/\/$/, '');
    if (wantsHtml && frontend && frontend !== 'http://localhost:3000') {
      return res.redirect(302, frontend);
    }
    return res.json({
      success: true,
      data: {
        name: 'Kushlov API',
        version: '1.0.0',
        health: '/health',
        api: '/api',
        frontend: frontend ?? null,
      },
    });
  });

  app.get('/favicon.ico', (_req: Request, res: Response) => res.status(204).end());

  // CORS first — preflight OPTIONS must get headers before DB/auth middleware.
  app.use(
    cors({
      origin: (origin, cb) => {
        if (isOriginAllowed(origin)) return cb(null, true);
        logger.warn({ origin }, 'CORS blocked origin');
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  if (process.env.VERCEL) {
    app.use(vercelDbMiddleware);
  }

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
