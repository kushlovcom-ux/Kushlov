import { Router } from 'express';
import { z } from 'zod';
import { Gender } from '@kushlov/types';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadDocument, uploadMedia } from '../../middleware/upload';
import * as ctrl from './verification.controller';

const router = Router();
router.use(authenticate);

const basicSchema = z.object({
  name: z.string().min(2).max(60),
  username: z.string().min(3).max(30),
  bio: z.string().max(500).optional(),
  gender: z.nativeEnum(Gender),
  dob: z.coerce.date(),
  languages: z.array(z.string()).optional(),
  country: z.string().min(2),
});

router.get('/instructions', ctrl.getInstructions);
router.get('/me', ctrl.getMyVerification);
router.post('/basic', validate({ body: basicSchema }), ctrl.submitBasic);

router.post(
  '/documents',
  uploadDocument.fields([
    { name: 'governmentId', maxCount: 1 },
    { name: 'addressProof', maxCount: 1 },
  ]),
  ctrl.submitDocuments,
);

router.post(
  '/identity',
  uploadMedia.fields([
    { name: 'selfies', maxCount: 3 },
    { name: 'video', maxCount: 1 },
  ]),
  ctrl.submitIdentity,
);

export default router;
