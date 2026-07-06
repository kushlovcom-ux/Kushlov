import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadImage } from '../../middleware/upload';
import * as ctrl from './moderation.controller';

const router = Router();
router.use(authenticate);

const reportSchema = z.object({
  reportedUser: z.string().min(1),
  reason: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  contextType: z.enum(['profile', 'message', 'live', 'call']).optional(),
  contextRef: z.string().optional(),
});

router.post('/report', uploadImage.array('evidence', 5), validate({ body: reportSchema }), ctrl.reportUser);
router.post('/block/:userId', ctrl.blockUser);
router.delete('/block/:userId', ctrl.unblockUser);
router.get('/blocks', ctrl.listBlocks);

export default router;
