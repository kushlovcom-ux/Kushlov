import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireApprovedHost } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadImage } from '../../middleware/upload';
import * as ctrl from './live.controller';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listLive);
router.get('/:id', ctrl.getLive);

// Host-only stream lifecycle
router.post('/start', requireApprovedHost, uploadImage.single('thumbnail'), ctrl.startLive);
router.get('/:id/host-token', ctrl.hostToken);
router.post('/:id/end', ctrl.endLive);
router.post('/:id/moderator/:userId', ctrl.addModerator);

// Viewer interactions
router.post('/:id/join', ctrl.joinLive);
router.post('/:id/leave', ctrl.leaveLive);
router.post('/:id/chat', validate({ body: z.object({ message: z.string().min(1).max(500) }) }), ctrl.liveChat);
router.post('/:id/like', ctrl.likeLive);
router.post('/:id/gift', validate({ body: z.object({ giftId: z.string().min(1) }) }), ctrl.liveGift);
router.post('/:id/ban/:userId', ctrl.banFromLive);

export default router;
