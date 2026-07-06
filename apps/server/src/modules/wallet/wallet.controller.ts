import { Request, Response } from 'express';
import { WithdrawStatus } from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import {
  DiamondTransaction,
  GoldTransaction,
  WithdrawRequest,
} from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { ensureWallet } from '../../services/wallet.service';
import { getSettings } from '../../services/settings.service';

/** GET /wallet — current balances. */
export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  const wallet = await ensureWallet(req.user!.id);
  return ok(res, wallet);
});

/** GET /wallet/diamonds/transactions — diamond ledger history. */
export const getDiamondHistory = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user!.id };
  const [items, total] = await Promise.all([
    DiamondTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    DiamondTransaction.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

/** GET /wallet/gold/transactions — gold ledger history (hosts). */
export const getGoldHistory = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user!.id };
  const [items, total] = await Promise.all([
    GoldTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    GoldTransaction.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

/** POST /wallet/withdraw — host requests a payout (debited on admin approval). */
export const requestWithdraw = asyncHandler(async (req: Request, res: Response) => {
  const { goldAmount, method, destination } = req.body;
  const settings = await getSettings();

  if (goldAmount < settings.withdraw.minGold) {
    throw ApiError.badRequest(`Minimum withdrawal is ${settings.withdraw.minGold} gold`);
  }

  const wallet = await ensureWallet(req.user!.id);
  if (wallet.gold < goldAmount) throw ApiError.badRequest('Insufficient gold balance');

  const pending = await WithdrawRequest.exists({
    host: req.user!.id,
    status: { $in: [WithdrawStatus.Requested, WithdrawStatus.Approved] },
  });
  if (pending) throw ApiError.conflict('You already have a pending withdrawal request');

  const fiatAmount = Number((goldAmount * settings.withdraw.goldToFiatRate).toFixed(2));
  const request = await WithdrawRequest.create({
    host: req.user!.id,
    goldAmount,
    fiatAmount,
    currency: settings.withdraw.currency,
    method,
    destination,
  });
  return created(res, request, 'Withdrawal requested');
});

/** GET /wallet/withdrawals — my withdrawal requests. */
export const listMyWithdrawals = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { host: req.user!.id };
  const [items, total] = await Promise.all([
    WithdrawRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    WithdrawRequest.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
