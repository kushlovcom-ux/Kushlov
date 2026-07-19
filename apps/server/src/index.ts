import { createServer } from 'node:http';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/db';
import { getRedis } from './config/redis';
import { createApp } from './app';
import { initSocket } from './socket';
import { ensureSeed } from './seed';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  getRedis(); // eagerly connect if configured
  await ensureSeed();

  const app = createApp();
  const httpServer = createServer(app);
  // Identity verification uploads (selfies + live video) can take a while.
  httpServer.requestTimeout = 180_000;
  httpServer.headersTimeout = 185_000;
  httpServer.keepAliveTimeout = 190_000;
  initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 Kushlov API listening on http://localhost:${env.PORT}`);
    logger.info(`   Environment: ${env.NODE_ENV}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully…`);
    httpServer.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
  process.on('uncaughtException', (err) => logger.error({ err }, 'Uncaught exception'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
