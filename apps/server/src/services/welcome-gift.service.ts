import { Types } from 'mongoose';
import { DiamondTxnReason, Role } from '@kushlov/types';
import { Gift, User } from '../models';
import { creditDiamonds } from './wallet.service';

/**
 * Grant the admin-configured welcome gift (as diamonds) once when a normal
 * user creates their first profile. Idempotent via welcomeGiftClaimed.
 */
export async function grantWelcomeGiftIfEligible(
  userId: string | Types.ObjectId,
): Promise<{ granted: boolean; diamonds: number }> {
  const user = await User.findById(userId).select('role welcomeGiftClaimed');
  if (!user) return { granted: false, diamonds: 0 };
  if (user.role !== Role.User) return { granted: false, diamonds: 0 };
  if (user.welcomeGiftClaimed) return { granted: false, diamonds: 0 };

  const gift = await Gift.findOne({ isWelcomeGift: true, isActive: true }).sort({
    sortOrder: 1,
  });
  if (!gift || gift.diamondCost <= 0) return { granted: false, diamonds: 0 };

  // Claim first to avoid double-grant under concurrent profile saves.
  const claimed = await User.findOneAndUpdate(
    { _id: userId, role: Role.User, welcomeGiftClaimed: { $ne: true } },
    { $set: { welcomeGiftClaimed: true } },
    { new: true },
  );
  if (!claimed) return { granted: false, diamonds: 0 };

  await creditDiamonds({
    userId,
    amount: gift.diamondCost,
    reason: DiamondTxnReason.WelcomeGift,
    reference: gift._id as Types.ObjectId,
    referenceModel: 'Gift',
    meta: { giftName: gift.name, welcome: true },
  });

  return { granted: true, diamonds: gift.diamondCost };
}
