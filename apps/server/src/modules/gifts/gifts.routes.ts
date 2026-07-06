import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './gifts.controller';

const router = Router();

router.get('/', ctrl.listGifts);

router.use(authenticate);
const sendSchema = z.object({
  giftId: z.string().min(1),
  toUserId: z.string().min(1),
  context: z.enum(['chat', 'call', 'live']).optional(),
});
router.post('/send', validate({ body: sendSchema }), ctrl.sendGift);

export default router;
