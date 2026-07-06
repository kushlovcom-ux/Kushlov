import { Router } from 'express';
import { z } from 'zod';
import { authenticate, optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './payments.controller';

const router = Router();

// Webhook is public (verified via signature) and uses the raw body parser
// registered in app.ts before json parsing.
router.post('/webhook', ctrl.webhook);

router.get('/packages', optionalAuth, ctrl.listPackages);

router.use(authenticate);
router.post(
  '/purchase',
  validate({ body: z.object({ packageId: z.string().min(1) }) }),
  ctrl.purchaseDiamonds,
);
router.post('/:paymentId/verify', ctrl.verifyPayment);
router.get('/', ctrl.listMyPayments);

export default router;
