import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadMedia } from '../../middleware/upload';
import * as ctrl from './chat.controller';

const router = Router();
router.use(authenticate);

router.get('/conversations', ctrl.listConversations);
router.post(
  '/conversations',
  validate({ body: z.object({ userId: z.string().min(1) }) }),
  ctrl.openConversation,
);
router.get('/conversations/:id/messages', ctrl.getMessages);
router.post('/conversations/:id/messages', uploadMedia.single('file'), ctrl.sendMessage);
router.patch('/conversations/:id/read', ctrl.markRead);

router.delete('/messages/:id', ctrl.deleteMessage);
router.post(
  '/messages/:id/forward',
  validate({ body: z.object({ toUserId: z.string().min(1) }) }),
  ctrl.forwardMessage,
);

export default router;
