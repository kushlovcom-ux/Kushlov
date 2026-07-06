import { Router } from 'express';
import { authLimiter } from '../../middleware/rateLimit';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './auth.controller';
import {
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
} from './auth.validation';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), ctrl.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.post('/forgot-password', authLimiter, validate({ body: forgotSchema }), ctrl.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: resetSchema }), ctrl.resetPassword);

export default router;
