import { Router } from 'express';
import { z } from 'zod';
import { CallType } from '@kushlov/types';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './calls.controller';

const router = Router();
router.use(authenticate);

const initiateSchema = z.object({
  type: z.nativeEnum(CallType),
  calleeId: z.string().min(1),
});

router.post('/initiate', validate({ body: initiateSchema }), ctrl.initiateCall);
router.get('/history', ctrl.callHistory);
router.post('/:type/:id/accept', ctrl.acceptCall);
router.post('/:type/:id/reject', ctrl.rejectCall);
router.post('/:type/:id/end', ctrl.endCall);

export default router;
