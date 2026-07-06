import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@kushlov/types';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './wallet.controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getWallet);
router.get('/diamonds/transactions', ctrl.getDiamondHistory);
router.get('/gold/transactions', ctrl.getGoldHistory);

const withdrawSchema = z.object({
  goldAmount: z.number().int().positive(),
  method: z.string().default('bank'),
  destination: z.record(z.any()),
});
router.post('/withdraw', authorize(Role.Host), validate({ body: withdrawSchema }), ctrl.requestWithdraw);
router.get('/withdrawals', authorize(Role.Host), ctrl.listMyWithdrawals);

export default router;
