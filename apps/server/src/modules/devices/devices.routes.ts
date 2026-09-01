import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './devices.controller';

const router = Router();
router.use(authenticate);

const registerSchema = z.object({
  pushToken: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
  platform: z.enum(['android', 'ios', 'Android', 'iOS', 'ANDROID', 'IOS']).optional(),
  deviceId: z.string().min(1).optional(),
  appVersion: z.string().optional(),
  osVersion: z.string().optional(),
}).refine((b) => Boolean(b.pushToken || b.token), {
  message: 'pushToken required',
});

router.post('/register', validate({ body: registerSchema }), ctrl.registerDevice);
router.get('/', ctrl.listDevices);
router.delete('/:deviceId', ctrl.unregisterDevice);

export default router;
