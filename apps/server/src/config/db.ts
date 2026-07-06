import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

const cache = global.__mongooseCache ?? { conn: null, promise: null };
global.__mongooseCache = cache;

/** Connect to MongoDB with sensible pool + timeout settings. */
export async function connectDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  mongoose.connection.on('connected', () => logger.info('🗄️  MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  if (!cache.promise) {
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: process.env.VERCEL ? 5 : 20,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      autoIndex: env.NODE_ENV !== 'production',
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
