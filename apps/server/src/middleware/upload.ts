import multer from 'multer';
import { ApiError } from '../utils/ApiError';

/**
 * In-memory storage: files are held in a buffer and streamed straight to
 * Cloudinary, so we never write binaries to the API server's disk.
 */
const storage = multer.memoryStorage();

// heic/heif: iOS returns those straight from the photo library when the asset
// is not transcoded, and rejecting them fails the upload before it starts.
const IMAGE = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];
const VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/x-matroska'];
// expo-audio records .m4a; Android and iOS label it differently, so accept both.
const AUDIO = [
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/3gpp',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
];
const FILE = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
];
const DOC = ['application/pdf', ...IMAGE];

/** MediaRecorder often sends `video/webm;codecs=vp9,opus` — compare the base type only. */
function baseMime(mimetype: string) {
  return (mimetype || '').split(';')[0].trim().toLowerCase();
}

function fileFilter(allowed: string[]) {
  return (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const mime = baseMime(file.mimetype);
    file.mimetype = mime;
    if (allowed.includes(mime)) cb(null, true);
    else cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  };
}

export const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: fileFilter(IMAGE),
});

/**
 * Chat attachments, selfies and live verification video (kept modest to avoid
 * OOM / connection resets). Documents are included so chat can send files.
 */
export const uploadMedia = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024, files: 6, fieldSize: 2 * 1024 * 1024 },
  fileFilter: fileFilter([...IMAGE, ...VIDEO, ...AUDIO, ...FILE]),
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 4 },
  fileFilter: fileFilter(DOC),
});
