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
}

function mapType(resource: string, format?: string): MediaType {
  if (resource === 'video') {
    const audioFormats = ['mp3', 'wav', 'ogg', 'm4a', 'webm'];
    if (format && audioFormats.includes(format)) return MediaType.Audio;
    return MediaType.Video;
  }
  return MediaType.Image;
}

/**
 * Stream a buffer directly to Cloudinary. Falls back to an inline data URL in
 * local dev when Cloudinary is not configured, so the app remains runnable.
 */
export async function uploadBuffer(
  file: Express.Multer.File,
  folder: string,
  options: UploadApiOptions = {},
): Promise<UploadedMedia> {
  if (!hasCloudinary) {
    logger.warn('Cloudinary not configured — returning data URL fallback (dev only)');
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return {
      url: dataUrl,
      publicId: `dev/${folder}/${Date.now()}`,
      type: file.mimetype.startsWith('video')
        ? MediaType.Video
        : file.mimetype.startsWith('audio')
          ? MediaType.Audio
          : MediaType.Image,
      bytes: file.size,
    };
  }

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `kushlov/${folder}`,
        resource_type: 'auto',
        ...options,
      },
      (error, res) => {
        if (error || !res) return reject(ApiError.internal(error?.message ?? 'Upload failed'));
        resolve(res);
      },
    );
    stream.end(file.buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    type: mapType(result.resource_type, result.format),
    width: result.width,
    height: result.height,
    durationSec: result.duration,
    bytes: result.bytes,
    format: result.format,
  };
}

export async function deleteMedia(publicId: string, resourceType: 'image' | 'video' = 'image') {
  if (!hasCloudinary || publicId.startsWith('dev/')) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
