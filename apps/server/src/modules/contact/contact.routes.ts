import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './contact.controller';

const router = Router();
router.use(authenticate);

const submitSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(120),
  category: z.enum(['general', 'account', 'billing', 'host', 'safety', 'technical', 'other']),
  message: z.string().min(10, 'Message must be at least 10 characters').max(3000),
});

router.post('/', validate({ body: submitSchema }), ctrl.submitInquiry);
router.get('/', ctrl.listMyInquiries);

export default router;
