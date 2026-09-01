import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import usersRoutes from '../modules/users/users.routes';
import socialRoutes from '../modules/social/social.routes';
import moderationRoutes from '../modules/moderation/moderation.routes';
import verificationRoutes from '../modules/verification/verification.routes';
import walletRoutes from '../modules/wallet/wallet.routes';
import paymentsRoutes from '../modules/payments/payments.routes';
import giftsRoutes from '../modules/gifts/gifts.routes';
import chatRoutes from '../modules/chat/chat.routes';
import notificationsRoutes from '../modules/notifications/notifications.routes';
import devicesRoutes from '../modules/devices/devices.routes';
import callsRoutes from '../modules/calls/calls.routes';
import liveRoutes from '../modules/live/live.routes';
import adminRoutes from '../modules/admin/admin.routes';
import settingsRoutes from '../modules/settings/settings.routes';
import contactRoutes from '../modules/contact/contact.routes';
import reviewsRoutes from '../modules/reviews/reviews.routes';

/** Root API router — every feature module is mounted under /api here. */
export const apiRouter = Router();

apiRouter.get('/', (_req, res) =>
  res.json({ success: true, data: { name: 'Kushlov API', version: '1.0.0' } }),
);

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', usersRoutes);
apiRouter.use('/social', socialRoutes);
apiRouter.use('/moderation', moderationRoutes);
apiRouter.use('/verification', verificationRoutes);
apiRouter.use('/wallet', walletRoutes);
apiRouter.use('/payments', paymentsRoutes);
apiRouter.use('/gifts', giftsRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/notifications', notificationsRoutes);
apiRouter.use('/devices', devicesRoutes);
apiRouter.use('/calls', callsRoutes);
apiRouter.use('/live', liveRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/contact', contactRoutes);
apiRouter.use('/reviews', reviewsRoutes);
apiRouter.use('/admin', adminRoutes);
