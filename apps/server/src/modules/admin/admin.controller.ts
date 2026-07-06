import { Request, Response } from 'express';
import {
  AccountStatus,
  GoldTxnReason,
  LiveStatus,
  NotificationType,
  PaymentStatus,
  ReportStatus,
  Role,
  VerificationStatus,
  WithdrawStatus,
} from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import {
  AdminInstruction,
  DiamondTransaction,
  Gift,
  GoldTransaction,
  LiveStream,
  Payment,
  Report,
  Subscription,
  User,
  VerificationRequest,
  WithdrawRequest,
} from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { getSettings } from '../../services/settings.service';
import { debitGold } from '../../services/wallet.service';
import { notify } from '../../services/notification.service';
import { uploadBuffer } from '../../services/media.service';
import { closeRoom } from '../../services/livekit.service';

// --------------------------------------------------------------------------
// Dashboard / analytics
// --------------------------------------------------------------------------
export const analytics = asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalUsers,
    totalHosts,
    approvedHosts,
    liveNow,
    pendingVerifications,
    openReports,
    pendingWithdrawals,
    revenueAgg,
    newUsers7d,
  ] = await Promise.all([
    User.countDocuments({ role: Role.User }),
    User.countDocuments({ role: Role.Host }),
    User.countDocuments({ role: Role.Host, isHostApproved: true }),
    LiveStream.countDocuments({ status: LiveStatus.Live }),
    VerificationRequest.countDocuments({ status: VerificationStatus.Pending }),
    Report.countDocuments({ status: ReportStatus.Open }),
    WithdrawRequest.countDocuments({ status: WithdrawStatus.Requested }),
    Payment.aggregate([
      { $match: { status: PaymentStatus.Succeeded } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } }),
  ]);

  return ok(res, {
    totalUsers,
    totalHosts,
    approvedHosts,
    liveNow,
    pendingVerifications,
    openReports,
    pendingWithdrawals,
    revenue: revenueAgg[0]?.total ?? 0,
    paymentsCount: revenueAgg[0]?.count ?? 0,
    newUsers7d,
  });
});

// --------------------------------------------------------------------------
// Users
// --------------------------------------------------------------------------
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { q, role, status } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) filter.$or = [{ email: new RegExp(q, 'i') }, { username: new RegExp(q, 'i') }];

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items.map((u) => (u as any).toPublic()), page, limit, total));
});

export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, reason, suspendedUntil } = req.body as {
    status: AccountStatus;
    reason?: string;
    suspendedUntil?: string;
  };
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === Role.Admin) throw ApiError.forbidden('Cannot modify an admin account');

  user.status = status;
  if (status === AccountStatus.Banned) user.bannedReason = reason;
  if (status === AccountStatus.Suspended && suspendedUntil) {
    user.suspendedUntil = new Date(suspendedUntil);
  }
  if (status !== AccountStatus.Active) user.tokenVersion += 1; // force logout everywhere
  await user.save();

  return ok(res, (user as any).toPublic(), `User ${status}`);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === Role.Admin) throw ApiError.forbidden('Cannot delete an admin account');
  user.status = AccountStatus.Deleted;
  user.tokenVersion += 1;
  await user.save();
  return ok(res, null, 'User deleted');
});

// --------------------------------------------------------------------------
// Host verification review
// --------------------------------------------------------------------------
export const listVerifications = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query as Record<string, string>;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    VerificationRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'displayName username email avatarUrl'),
    VerificationRequest.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

export const getVerification = asyncHandler(async (req: Request, res: Response) => {
  const request = await VerificationRequest.findById(req.params.id)
    .populate('user', 'displayName username email avatarUrl')
    .populate('instructionsUsed');
  if (!request) throw ApiError.notFound('Verification request not found');
  return ok(res, request);
});

export const reviewVerification = asyncHandler(async (req: Request, res: Response) => {
  const { decision, note } = req.body as { decision: VerificationStatus; note?: string };
  const request = await VerificationRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound('Verification request not found');

  request.status = decision;
  request.reviewNote = note;
  request.reviewedBy = req.user!.id as any;
  request.reviewedAt = new Date();
  await request.save();

  if (decision === VerificationStatus.Approved) {
    await User.findByIdAndUpdate(request.user, {
      role: Role.Host,
      isHostApproved: true,
      hostSince: new Date(),
    });
  } else if (decision === VerificationStatus.Rejected) {
    await User.findByIdAndUpdate(request.user, { isHostApproved: false });
  }

  await notify({
    userId: request.user,
    type: NotificationType.Verification,
    title: `Host verification ${decision.replace('_', ' ')}`,
    body: note ?? 'Your verification status has been updated',
    data: { verificationId: request._id.toString(), status: decision },
  });

  return ok(res, request, `Verification ${decision}`);
});

// --------------------------------------------------------------------------
// Admin instructions (host capture guidance)
// --------------------------------------------------------------------------
export const listInstructions = asyncHandler(async (_req: Request, res: Response) => {
  const items = await AdminInstruction.find().sort({ sortOrder: 1 });
  return ok(res, items);
});

export const createInstruction = asyncHandler(async (req: Request, res: Response) => {
  const instruction = await AdminInstruction.create({ ...req.body, createdBy: req.user!.id });
  return created(res, instruction, 'Instruction created');
});

export const updateInstruction = asyncHandler(async (req: Request, res: Response) => {
  const instruction = await AdminInstruction.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!instruction) throw ApiError.notFound('Instruction not found');
  return ok(res, instruction, 'Instruction updated');
});

export const deleteInstruction = asyncHandler(async (req: Request, res: Response) => {
  await AdminInstruction.findByIdAndDelete(req.params.id);
  return ok(res, null, 'Instruction deleted');
});

// --------------------------------------------------------------------------
// Reports
// --------------------------------------------------------------------------
export const listReports = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query as Record<string, string>;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reporter', 'displayName username')
      .populate('reportedUser', 'displayName username avatarUrl status'),
    Report.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

export const resolveReport = asyncHandler(async (req: Request, res: Response) => {
  const { status, resolutionNote } = req.body as { status: ReportStatus; resolutionNote?: string };
  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { status, resolutionNote, handledBy: req.user!.id },
    { new: true },
  );
  if (!report) throw ApiError.notFound('Report not found');
  return ok(res, report, 'Report updated');
});

// --------------------------------------------------------------------------
// Payments, transactions, subscriptions
// --------------------------------------------------------------------------
export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query as Record<string, string>;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'displayName username email'),
    Payment.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const type = (req.query.type as string) === 'gold' ? 'gold' : 'diamond';
  const Model = (type === 'gold' ? GoldTransaction : DiamondTransaction) as typeof DiamondTransaction;
  const [items, total] = await Promise.all([
    Model.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'displayName username'),
    Model.countDocuments(),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

export const listSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    Subscription.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'displayName username'),
    Subscription.countDocuments(),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

// --------------------------------------------------------------------------
// Withdraw requests
// --------------------------------------------------------------------------
export const listWithdrawals = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query as Record<string, string>;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    WithdrawRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('host', 'displayName username email'),
    WithdrawRequest.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

export const reviewWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const { status, note } = req.body as { status: WithdrawStatus; note?: string };
  const request = await WithdrawRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound('Withdrawal not found');
  if (request.status === WithdrawStatus.Paid) throw ApiError.badRequest('Already paid');

  // Debit the host's gold only when the payout is actually marked as paid.
  if (status === WithdrawStatus.Paid) {
    await debitGold({
      hostId: request.host,
      amount: request.goldAmount,
      reason: GoldTxnReason.Withdraw,
      reference: request._id,
      referenceModel: 'WithdrawRequest',
    });
    request.processedAt = new Date();
  }
  request.status = status;
  request.reviewNote = note;
  request.reviewedBy = req.user!.id as any;
  await request.save();

  await notify({
    userId: request.host,
    type: NotificationType.Payment,
    title: `Withdrawal ${status}`,
    body: note ?? `Your withdrawal of ${request.goldAmount} gold is ${status}`,
  });
  return ok(res, request, `Withdrawal ${status}`);
});

// --------------------------------------------------------------------------
// Gifts catalog
// --------------------------------------------------------------------------
export const listAllGifts = asyncHandler(async (_req: Request, res: Response) => {
  const items = await Gift.find().sort({ sortOrder: 1 });
  return ok(res, items);
});

export const createGift = asyncHandler(async (req: Request, res: Response) => {
  let imageUrl = req.body.imageUrl;
  let imagePublicId;
  if (req.file) {
    const media = await uploadBuffer(req.file, 'gifts');
    imageUrl = media.url;
    imagePublicId = media.publicId;
  }
  if (!imageUrl) throw ApiError.badRequest('Gift image is required');
  const gift = await Gift.create({ ...req.body, imageUrl, imagePublicId });
  return created(res, gift, 'Gift created');
});

export const updateGift = asyncHandler(async (req: Request, res: Response) => {
  const update = { ...req.body };
  if (req.file) {
    const media = await uploadBuffer(req.file, 'gifts');
    update.imageUrl = media.url;
    update.imagePublicId = media.publicId;
  }
  const gift = await Gift.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!gift) throw ApiError.notFound('Gift not found');
  return ok(res, gift, 'Gift updated');
});

export const deleteGift = asyncHandler(async (req: Request, res: Response) => {
  await Gift.findByIdAndDelete(req.params.id);
  return ok(res, null, 'Gift deleted');
});

// --------------------------------------------------------------------------
// Live moderation + settings
// --------------------------------------------------------------------------
export const listAllLive = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    LiveStream.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('host', 'displayName username'),
    LiveStream.countDocuments(),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

export const forceEndLive = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound('Stream not found');
  live.status = LiveStatus.Ended;
  live.endedAt = new Date();
  await live.save();
  await closeRoom(live.roomName);
  return ok(res, live, 'Stream force-ended');
});

export const getAdminSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getSettings();
  return ok(res, settings);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getSettings();
  const updatable = [
    'goldConversionRatio',
    'rates',
    'diamondPackages',
    'withdraw',
    'features',
    'announcements',
  ];
  for (const key of updatable) if (key in req.body) (settings as any)[key] = req.body[key];
  await settings.save();
  return ok(res, settings, 'Settings updated');
});
