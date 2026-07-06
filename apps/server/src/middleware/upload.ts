import multer from 'multer';
import { ApiError } from '../utils/ApiError';

/**
 * In-memory storage: files are held in a buffer and streamed straight to
 * Cloudinary, so we never write binaries to the API server's disk.
 */
const storage = multer.memoryStorage();

const IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const AUDIO = ['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'];
const DOC = ['application/pdf', ...IMAGE];

function fileFilter(allowed: string[]) {
  return (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  };
}

export const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter(IMAGE),
});

export const uploadMedia = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: fileFilter([...IMAGE, ...VIDEO, ...AUDIO]),
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: fileFilter(DOC),
});
