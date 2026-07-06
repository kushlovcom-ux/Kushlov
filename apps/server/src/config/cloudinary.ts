import { v2 as cloudinary } from 'cloudinary';
import { env, hasCloudinary } from './env';
import { logger } from './logger';

/**
 * Cloudinary is the single source of truth for all media. We only ever persist
 * the returned URL + metadata in MongoDB — never the binary itself.
 */
if (hasCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  logger.info('☁️  Cloudinary configured');
} else {
  logger.warn('Cloudinary not configured — uploads will use a local dev fallback');
}

export { cloudinary };
