import { Router } from 'express';
import { z } from 'zod';
import {
  AccountStatus,
  ReportStatus,
  VerificationStatus,
  WithdrawStatus,
} from '@kushlov/types';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@kushlov/types';
import { validate } from '../../middleware/validate';
import { uploadImage } from '../../middleware/upload';
import * as ctrl from './admin.controller';

const router = Router();
router.use(authenticate, authorize(Role.Admin));

// Dashboard
router.get('/analytics', ctrl.analytics);
router.get('/badges', ctrl.adminBadges);

// Users
router.get('/users', ctrl.listUsers);
router.get('/online', ctrl.listOnlineUsers);
router.get('/users/:id', ctrl.getUserAdmin);
router.patch(
  '/users/:id',
  validate({
    body: z.object({
      displayName: z.string().min(2).max(60).optional(),
      username: z.string().min(3).max(30).optional(),
      email: z.string().email().optional(),
      bio: z.string().max(500).optional(),
      gender: z.string().optional(),
      country: z.string().min(2).max(80).optional(),
      isHostApproved: z.boolean().optional(),
      videoPrice: z.number().min(0).optional(),
      audioPrice: z.number().min(0).optional(),
      messagePrice: z.number().min(0).optional(),
      isPopularHost: z.boolean().optional(),
      popularSortOrder: z.number().min(0).optional(),
    }),
  }),
  ctrl.updateUserAdmin,
);
router.patch(
  '/users/:id/status',
  validate({
    body: z.object({
      status: z.nativeEnum(AccountStatus),
      reason: z.string().optional(),
      suspendedUntil: z.string().optional(),
    }),
  }),
  ctrl.updateUserStatus,
);
router.delete('/users/:id', ctrl.deleteUser);

// Host verification
router.get('/verifications', ctrl.listVerifications);
router.get('/verifications/:id', ctrl.getVerification);
router.patch(
  '/verifications/:id/review',
  validate({
    body: z.object({ decision: z.nativeEnum(VerificationStatus), note: z.string().optional() }),
  }),
  ctrl.reviewVerification,
);

// Admin instructions
router.get('/instructions', ctrl.listInstructions);
router.post(
  '/instructions',
  validate({
    body: z.object({
      text: z.string().min(2),
      category: z.enum(['selfie', 'video', 'general']).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }),
  }),
  ctrl.createInstruction,
);
router.patch('/instructions/:id', ctrl.updateInstruction);
router.delete('/instructions/:id', ctrl.deleteInstruction);

// Reports
router.get('/reports', ctrl.listReports);
router.patch(
  '/reports/:id',
  validate({
    body: z.object({ status: z.nativeEnum(ReportStatus), resolutionNote: z.string().optional() }),
  }),
  ctrl.resolveReport,
);

// Payments / transactions / subscriptions
router.get('/payments', ctrl.listPayments);
router.get('/transactions', ctrl.listTransactions);
router.get('/subscriptions', ctrl.listSubscriptions);
router.post(
  '/diamonds/grant',
  validate({
    body: z.object({
      userId: z.string().min(1),
      amount: z.number().positive().max(1_000_000),
      note: z.string().max(300).optional(),
    }),
  }),
  ctrl.grantDiamonds,
);
router.get('/diamonds/grants', ctrl.listDiamondGrants);

// Withdrawals
router.get('/withdrawals', ctrl.listWithdrawals);
router.patch(
  '/withdrawals/:id',
  validate({ body: z.object({ status: z.nativeEnum(WithdrawStatus), note: z.string().optional() }) }),
  ctrl.reviewWithdrawal,
);

// Gifts
router.get('/gifts', ctrl.listAllGifts);
router.post('/gifts', uploadImage.single('image'), ctrl.createGift);
router.patch('/gifts/:id', uploadImage.single('image'), ctrl.updateGift);
router.delete('/gifts/:id', ctrl.deleteGift);

// Live moderation
router.get('/live', ctrl.listAllLive);
router.post('/live/:id/force-end', ctrl.forceEndLive);

// Settings
router.get('/settings', ctrl.getAdminSettings);
router.patch('/settings', ctrl.updateSettings);
router.get('/config', ctrl.getAdminSettings);
router.put('/config', ctrl.updateSettings);

// Host pricing
router.get('/hosts', ctrl.listHostsAdmin);
router.patch(
  '/hosts/:id/pricing',
  validate({
    body: z.object({
      videoPrice: z.number().min(0).optional(),
      audioPrice: z.number().min(0).optional(),
      messagePrice: z.number().min(0).optional(),
    }),
  }),
  ctrl.updateHostPricing,
);
router.patch(
  '/hosts/:id/popular',
  validate({
    body: z.object({
      isPopularHost: z.boolean().optional(),
      popularSortOrder: z.number().min(0).optional(),
    }),
  }),
  ctrl.updateHostPopular,
);

// Reviews moderation
router.get('/reviews', ctrl.listReviewsAdmin);
router.patch(
  '/reviews/:id',
  validate({ body: z.object({ isHidden: z.boolean() }) }),
  ctrl.patchReviewAdmin,
);
router.delete('/reviews/:id', ctrl.deleteReviewAdmin);

// Contact inquiries
router.get('/inquiries', ctrl.listInquiries);
router.patch(
  '/inquiries/:id',
  validate({
    body: z.object({
      adminReply: z.string().optional(),
      adminNote: z.string().optional(),
      status: z.enum(['open', 'in_progress', 'resolved']).optional(),
    }),
  }),
  ctrl.replyInquiry,
);
router.delete('/inquiries/:id', ctrl.deleteInquiry);

export default router;
