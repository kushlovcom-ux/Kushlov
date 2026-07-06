import { ClientSession, Types } from 'mongoose';
import {
  DiamondTxnReason,
  GoldTxnReason,
  LedgerDirection,
} from '@kushlov/types';
import { diamondsToGold } from '@kushlov/utils';
import {
  DiamondTransaction,
  GoldTransaction,
  Wallet,
  IWallet,
} from '../models';
import { ApiError } from '../utils/ApiError';
import { getSettings } from './settings.service';

/** Ensure a wallet exists for a user (idempotent). */
export async function ensureWallet(userId: string | Types.ObjectId): Promise<IWallet> {
  return Wallet.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { upsert: true, new: true },
  );
}

/** Credit diamonds (e.g. after a successful purchase or refund). */
export async function creditDiamonds(params: {
  userId: string | Types.ObjectId;
  amount: number;
  reason: DiamondTxnReason;
  reference?: Types.ObjectId;
  referenceModel?: string;
  meta?: Record<string, unknown>;
  session?: ClientSession;
}): Promise<IWallet> {
  const { userId, amount, reason, reference, referenceModel, meta, session } = params;
  if (amount <= 0) throw ApiError.badRequest('Amount must be positive');

  const wallet = await Wallet.findOneAndUpdate(
    { user: userId },
    {
      $inc: {
        diamonds: amount,
        ...(reason === DiamondTxnReason.Purchase ? { totalDiamondsPurchased: amount } : {}),
      },
      $setOnInsert: { user: userId },
    },
    { upsert: true, new: true, session },
  );

  await DiamondTransaction.create(
    [
      {
        user: userId,
        direction: LedgerDirection.Credit,
        amount,
        balanceAfter: wallet.diamonds,
        reason,
        reference,
        referenceModel,
        meta,
      },
    ],
    { session },
  );
  return wallet;
}

/**
 * Spend diamonds from a user AND credit the corresponding gold to a host,
 * as an atomic double-entry using the configured conversion ratio.
 */
export async function spendDiamonds(params: {
  userId: string | Types.ObjectId;
  hostId?: string | Types.ObjectId;
  amount: number;
  diamondReason: DiamondTxnReason;
  goldReason?: GoldTxnReason;
  reference?: Types.ObjectId;
  referenceModel?: string;
  meta?: Record<string, unknown>;
}): Promise<{ diamondsLeft: number; goldEarned: number }> {
  const { userId, hostId, amount, diamondReason, goldReason, reference, referenceModel, meta } =
    params;
  if (amount <= 0) throw ApiError.badRequest('Amount must be positive');

  const settings = await getSettings();
  const goldEarned = hostId ? diamondsToGold(amount, settings.goldConversionRatio) : 0;

  // Atomically debit only if the balance is sufficient.
  const wallet = await Wallet.findOneAndUpdate(
    { user: userId, diamonds: { $gte: amount } },
    { $inc: { diamonds: -amount } },
    { new: true },
  );
  if (!wallet) throw ApiError.badRequest('Insufficient diamond balance', { balance: ['too_low'] });

  await DiamondTransaction.create({
    user: userId,
    direction: LedgerDirection.Debit,
    amount,
    balanceAfter: wallet.diamonds,
    reason: diamondReason,
    reference,
    referenceModel,
    meta,
  });

  if (hostId && goldEarned > 0) {
    const hostWallet = await Wallet.findOneAndUpdate(
      { user: hostId },
      { $inc: { gold: goldEarned, totalGoldEarned: goldEarned }, $setOnInsert: { user: hostId } },
      { upsert: true, new: true },
    );
    await GoldTransaction.create({
      user: hostId,
      direction: LedgerDirection.Credit,
      amount: goldEarned,
      balanceAfter: hostWallet.gold,
      reason: goldReason ?? GoldTxnReason.Gift,
      fromUser: userId,
      reference,
      referenceModel,
      meta,
    });
  }

  return { diamondsLeft: wallet.diamonds, goldEarned };
}

/** Debit gold from a host (e.g. approved withdrawal). */
export async function debitGold(params: {
  hostId: string | Types.ObjectId;
  amount: number;
  reason: GoldTxnReason;
  reference?: Types.ObjectId;
  referenceModel?: string;
}): Promise<IWallet> {
  const { hostId, amount, reason, reference, referenceModel } = params;
  const wallet = await Wallet.findOneAndUpdate(
    { user: hostId, gold: { $gte: amount } },
    { $inc: { gold: -amount, totalGoldWithdrawn: amount } },
    { new: true },
  );
  if (!wallet) throw ApiError.badRequest('Insufficient gold balance');

  await GoldTransaction.create({
    user: hostId,
    direction: LedgerDirection.Debit,
    amount,
    balanceAfter: wallet.gold,
    reason,
    reference,
    referenceModel,
  });
  return wallet;
}
