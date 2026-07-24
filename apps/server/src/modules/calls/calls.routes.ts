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
  calleeId: z.string().min(1).optional(),
  participantIds: z.array(z.string().min(1)).max(5).optional(),
}).refine((b) => Boolean(b.calleeId || (b.participantIds && b.participantIds.length > 0)), {
  message: 'calleeId or participantIds required',
});

router.post('/initiate', validate({ body: initiateSchema }), ctrl.initiateCall);
router.get('/incoming', ctrl.listIncomingCalls);
router.get('/history', ctrl.callHistory);
router.get('/:type/:id', ctrl.getCall);
router.post('/:type/:id/accept', ctrl.acceptCall);
router.post('/:type/:id/accept-interrupt', ctrl.acceptInterrupt);
router.post('/:type/:id/reject', ctrl.rejectCall);
router.post(
  '/:type/:id/invite',
  validate({ body: z.object({ userId: z.string().min(1) }) }),
  ctrl.inviteToCall,
);
router.post('/:type/:id/participants/:userId/remove', ctrl.removeCallParticipant);
router.post('/:type/:id/end', ctrl.endCall);

export default router;
