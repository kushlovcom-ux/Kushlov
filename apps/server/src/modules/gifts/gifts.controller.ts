import { Request, Response } from 'express';
import {
  DiamondTxnReason,
  GoldTxnReason,
  NotificationType,
} from '@kushlov/types';
import { Gift, User } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { spendDiamonds } from '../../services/wallet.service';
import { notify } from '../../services/notification.service';

/** GET /gifts — active gift catalog. */
export const listGifts = asyncHandler(async (_req: Request, res: Response) => {
  const gifts = await Gift.find({ isActive: true }).sort({ sortOrder: 1, diamondCost: 1 });
  return ok(res, gifts);
});

/**
 * POST /gifts/send — spend diamonds to send a gift; recipient earns gold.
 * `context` lets the same endpoint back gifts in chat, calls or live streams.
 */
export const sendGift = asyncHandler(async (req: Request, res: Response) => {
  const { giftId, toUserId } = req.body;
  if (toUserId === req.user!.id) throw ApiError.badRequest('You cannot gift yourself');

  const [gift, recipient] = await Promise.all([
    Gift.findOne({ _id: giftId, isActive: true }),
    User.findById(toUserId).select('displayName'),
  ]);
  if (!gift) throw ApiError.notFound('Gift not found');
  if (!recipient) throw ApiError.notFound('Recipient not found');

  const result = await spendDiamonds({
    userId: req.user!.id,
    hostId: toUserId,
    amount: gift.diamondCost,
    diamondReason: DiamondTxnReason.Gift,
    goldReason: GoldTxnReason.Gift,
    reference: gift._id,
    referenceModel: 'Gift',
    meta: { giftName: gift.name, context: req.body.context ?? 'chat' },
  });

  await notify({
    userId: toUserId,
    actor: req.user!.id,
    type: NotificationType.Gift,
    title: `You received a ${gift.name}! 🎁`,
    body: `+${result.goldEarned} gold`,
    data: { giftId: gift._id, imageUrl: gift.imageUrl, gold: result.goldEarned },
  });

  return created(
    res,
    { gift, ...result },
    `Sent ${gift.name} to ${recipient.displayName}`,
  );
});
