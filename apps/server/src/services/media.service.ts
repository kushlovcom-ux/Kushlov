import { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { MediaType } from '@kushlov/types';
import { cloudinary } from '../config/cloudinary';
import { hasCloudinary } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';

export interface UploadedMedia {
  url: string;
  publicId: string;
  type: MediaType;
  width?: number;
  height?: number;
  durationSec?: number;
  bytes?: number;
  format?: string;
  fileName?: string;
  mimeType?: string;
}

/**
 * The uploaded MIME type is the source of truth. Cloudinary's `resource_type`
 * is not: it files PDFs under `image` and .m4a voice notes under `video`, so
 * trusting it turned documents into broken photo bubbles in chat.
 */
function mapType(resource: string, format?: string, mimetype?: string): MediaType {
  if (mimetype?.startsWith('image/')) return MediaType.Image;
  if (mimetype?.startsWith('audio/')) return MediaType.Audio;
  if (mimetype?.startsWith('video/')) {
    // webm is commonly used for live verification video — treat as video, not
    // audio, unless the transcoded result really has no video stream.
    const audioFormats = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba'];
    return format && audioFormats.includes(format) ? MediaType.Audio : MediaType.Video;
  }
  if (mimetype) return MediaType.Raw;

  if (resource === 'raw') return MediaType.Raw;
  if (resource === 'video') return MediaType.Video;
  return MediaType.Image;
}

/**
 * Stream a buffer directly to Cloudinary. Falls back to an inline data URL in
 * local dev when Cloudinary is not configured, so the app remains runnable.
 */
/** Dev-only data URLs must stay tiny — large video base64 OOMs Node and resets the connection. */
const DEV_DATA_URL_MAX_BYTES = 1.5 * 1024 * 1024;

export async function uploadBuffer(
  file: Express.Multer.File,
  folder: string,
  options: UploadApiOptions = {},
): Promise<UploadedMedia> {
  if (!hasCloudinary) {
    if (file.size > DEV_DATA_URL_MAX_BYTES || file.mimetype.startsWith('video/')) {
      throw ApiError.badRequest(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to upload verification media.',
      );
    }
    logger.warn('Cloudinary not configured — returning data URL fallback (dev only)');
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return {
      url: dataUrl,
      publicId: `dev/${folder}/${Date.now()}`,
      type: file.mimetype.startsWith('video')
        ? MediaType.Video
        : file.mimetype.startsWith('audio')
          ? MediaType.Audio
          : file.mimetype.startsWith('image')
            ? MediaType.Image
            : MediaType.Raw,
      bytes: file.size,
      fileName: file.originalname,
      mimeType: file.mimetype,
    };
  }

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `kushlov/${folder}`,
        resource_type: 'auto',
        timeout: 120_000,
        ...options,
      },
      (error, res) => {
        if (error || !res) {
          logger.error({ err: error, folder, mimetype: file.mimetype, bytes: file.size }, 'Cloudinary upload failed');
          return reject(
            ApiError.internal(error?.message ?? 'Media upload failed — please try a shorter video'),
          );
        }
        resolve(res);
      },
    );
    stream.end(file.buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    type: mapType(result.resource_type, result.format, file.mimetype),
    width: result.width,
    height: result.height,
    durationSec: result.duration,
    bytes: result.bytes,
    format: result.format,
    fileName: file.originalname,
    mimeType: file.mimetype,
  };
}

export async function deleteMedia(publicId: string, resourceType: 'image' | 'video' = 'image') {
  if (!hasCloudinary || publicId.startsWith('dev/')) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
