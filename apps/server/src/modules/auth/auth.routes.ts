import { Router } from 'express';
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  refreshLimiter,
} from '../../middleware/rateLimit';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './auth.controller';
import {
  forgotSchema,
  googleSchema,
  loginSchema,
  registerSchema,
  resetSchema,
} from './auth.validation';

const router = Router();

router.post('/register', registerLimiter, validate({ body: registerSchema }), ctrl.register);
router.post('/login', loginLimiter, validate({ body: loginSchema }), ctrl.login);
router.post('/google', loginLimiter, validate({ body: googleSchema }), ctrl.googleLogin);
router.post('/refresh', refreshLimiter, ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate({ body: forgotSchema }),
  ctrl.forgotPassword,
);
router.post(
  '/reset-password',
  passwordResetLimiter,
  validate({ body: resetSchema }),
  ctrl.resetPassword,
);

export default router;
