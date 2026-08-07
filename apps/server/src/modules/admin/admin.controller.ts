import { Request, Response } from 'express';
import {
  AccountStatus,
  DiamondTxnReason,
  GoldTxnReason,
  LedgerDirection,
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
  ContactInquiry,
  ContactStatus,
  DiamondTransaction,
  Gift,
  GoldTransaction,
  LiveStream,
  Payment,
  Profile,
  Report,
  Review,
  Subscription,
  User,
  VerificationRequest,
  Wallet,
  WithdrawRequest,
} from '../../models';
import { recomputeHostRating, serializeReview } from '../../services/review.service';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { getSettings } from '../../services/settings.service';
import { debitGold } from '../../services/wallet.service';
import { notify } from '../../services/notification.service';
import { uploadBuffer } from '../../services/media.service';
import { closeRoom } from '../../services/livekit.service';
import { purgeUserCompletely } from '../../services/user-purge.service';
import { PRESENCE_ONLINE_MS, sweepStalePresence } from '../../services/presence.service';
import { creditDiamonds } from '../../services/wallet.service';

// --------------------------------------------------------------------------
// Dashboard / analytics
// --------------------------------------------------------------------------
/** Short TTL cache so dashboard remounts don't re-scan payments every time. */
let analyticsCache: { at: number; data: Record<string, number> } | null = null;
const ANALYTICS_TTL_MS = 45_000;

export const analytics = asyncHandler(async (_req: Request, res: Response) => {
  if (analyticsCache && Date.now() - analyticsCache.at < ANALYTICS_TTL_MS) {
    return ok(res, analyticsCache.data);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5);
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
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
  ]);

  const data = {
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
  };
  analyticsCache = { at: Date.now(), data };
  return ok(res, data);
});

/** GET /admin/badges — lightweight pending-action counts for admin nav badges. */
export const adminBadges = asyncHandler(async (_req: Request, res: Response) => {
  const [verifications, reports, withdrawals, inquiries] = await Promise.all([
    VerificationRequest.countDocuments({ status: VerificationStatus.Pending }),
    Report.countDocuments({ status: ReportStatus.Open }),
    WithdrawRequest.countDocuments({ status: WithdrawStatus.Requested }),
    ContactInquiry.countDocuments({ status: ContactStatus.Open }),
  ]);
  return ok(res, {
    verifications,
    reports,
    withdrawals,
    inquiries,
    total: verifications + reports + withdrawals + inquiries,
  });
});

// --------------------------------------------------------------------------
// Users
// --------------------------------------------------------------------------
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { q, role, status } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {
    // Soft-deleted leftovers stay hidden; hard-delete removes the row entirely.
    status: { $ne: AccountStatus.Deleted },
  };
  if (role === Role.User || role === Role.Host) filter.role = role;
  if (status && status !== AccountStatus.Deleted) filter.status = status;
  if (q) {
    filter.$or = [
      { email: new RegExp(q, 'i') },
      { username: new RegExp(q, 'i') },
      { displayName: new RegExp(q, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items.map((u) => (u as any).toPublic()), page, limit, total));
});

/** GET /admin/users/:id — full admin user detail (wallet + location read-only). */
export const getUserAdmin = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user || user.status === AccountStatus.Deleted) {
    throw ApiError.notFound('User not found');
  }

  const [wallet, profile] = await Promise.all([
    Wallet.findOne({ user: user._id }).lean(),
    Profile.findOne({ user: user._id })
      .select('city country locationLabel locationUpdatedAt gender dob languages')
      .lean(),
  ]);

  const locationLabel =
    profile?.locationLabel ||
    [profile?.city, profile?.country].filter(Boolean).join(', ') ||
    user.country ||
    'Location not set';

  return ok(res, {
    user: (user as any).toPublic(),
    wallet: {
      diamonds: wallet?.diamonds ?? 0,
      gold: wallet?.gold ?? 0,
      totalDiamondsPurchased: wallet?.totalDiamondsPurchased ?? 0,
      totalGoldEarned: wallet?.totalGoldEarned ?? 0,
      totalGoldWithdrawn: wallet?.totalGoldWithdrawn ?? 0,
    },
    location: {
      label: locationLabel,
      city: profile?.city ?? null,
      country: profile?.country ?? user.country ?? null,
      updatedAt: profile?.locationUpdatedAt
        ? new Date(profile.locationUpdatedAt).toISOString()
        : null,
    },
    profile: {
      bio: user.bio ?? '',
      gender: profile?.gender ?? user.gender,
      dob: profile?.dob ? new Date(profile.dob as Date).toISOString() : null,
      languages: profile?.languages ?? [],
    },
  });
});

/** PATCH /admin/users/:id — update account details (not diamonds, gold, or location). */
export const updateUserAdmin = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === Role.Admin) throw ApiError.forbidden('Cannot modify an admin account');

  const {
    displayName,
    username,
    email,
    bio,
    gender,
    country,
    isHostApproved,
    videoPrice,
    audioPrice,
    messagePrice,
    isPopularHost,
    popularSortOrder,
  } = req.body as {
    displayName?: string;
    username?: string;
    email?: string;
    bio?: string;
    gender?: string;
    country?: string;
    isHostApproved?: boolean;
    videoPrice?: number;
    audioPrice?: number;
    messagePrice?: number;
    isPopularHost?: boolean;
    popularSortOrder?: number;
  };

  if (displayName !== undefined) user.displayName = String(displayName).trim().slice(0, 60);
  if (username !== undefined) {
    const next = String(username).trim().toLowerCase().slice(0, 30);
    if (next.length < 3) throw ApiError.badRequest('Username must be at least 3 characters');
    const taken = await User.exists({ username: next, _id: { $ne: user._id } });
    if (taken) throw ApiError.conflict('Username already taken');
    user.username = next;
  }
  if (email !== undefined) {
    const next = String(email).trim().toLowerCase();
    if (!next.includes('@')) throw ApiError.badRequest('Invalid email');
    const taken = await User.exists({ email: next, _id: { $ne: user._id } });
    if (taken) throw ApiError.conflict('Email already taken');
    user.email = next;
  }
  if (bio !== undefined) user.bio = String(bio).slice(0, 500);
  if (gender !== undefined) user.gender = gender as any;
  if (country !== undefined) user.country = String(country).trim().slice(0, 80);
  if (typeof isHostApproved === 'boolean') user.isHostApproved = isHostApproved;
  if (typeof videoPrice === 'number' && videoPrice >= 0) user.videoPrice = videoPrice;
  if (typeof audioPrice === 'number' && audioPrice >= 0) user.audioPrice = audioPrice;
  if (typeof messagePrice === 'number' && messagePrice >= 0) user.messagePrice = messagePrice;
  if (typeof isPopularHost === 'boolean') {
    user.isPopularHost = isPopularHost;
    if (!isPopularHost) user.popularSortOrder = 0;
  }
  if (typeof popularSortOrder === 'number' && popularSortOrder >= 0) {
    user.popularSortOrder = popularSortOrder;
  }

  await user.save();

  // Keep profile gender/country in sync (location fields untouched).
  const profile = await Profile.findOne({ user: user._id });
  if (profile) {
    if (gender !== undefined) profile.gender = user.gender as any;
    if (country !== undefined) profile.country = user.country;
    await profile.save();
  }

  return ok(res, (user as any).toPublic(), 'User updated');
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

  // Invalidate sessions first, then hard-delete user + related data.
  user.tokenVersion += 1;
  await user.save();
  await purgeUserCompletely(user._id);
  return ok(res, null, 'User permanently deleted');
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
    await User.findByIdAndUpdate(request.user, {
      isHostApproved: false,
    });
  } else if (decision === VerificationStatus.NeedMoreInfo) {
    // Ensure the host can open /become-host and complete the full 3-step flow again.
    await User.findByIdAndUpdate(request.user, {
      isHostApproved: false,
    });
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
  const isWelcomeGift = req.body.isWelcomeGift === true || req.body.isWelcomeGift === 'true';
  if (isWelcomeGift) {
    await Gift.updateMany({ isWelcomeGift: true }, { $set: { isWelcomeGift: false } });
  }
  const gift = await Gift.create({
    ...req.body,
    imageUrl,
    imagePublicId,
    isWelcomeGift,
    diamondCost: Number(req.body.diamondCost),
    goldValue: Number(req.body.goldValue ?? 0),
  });
  return created(res, gift, 'Gift created');
});

export const updateGift = asyncHandler(async (req: Request, res: Response) => {
  const update = { ...req.body };
  if (req.file) {
    const media = await uploadBuffer(req.file, 'gifts');
    update.imageUrl = media.url;
    update.imagePublicId = media.publicId;
  }
  if (update.diamondCost != null) update.diamondCost = Number(update.diamondCost);
  if (update.goldValue != null) update.goldValue = Number(update.goldValue);
  if (update.isWelcomeGift === 'true') update.isWelcomeGift = true;
  if (update.isWelcomeGift === 'false') update.isWelcomeGift = false;
  if (update.isWelcomeGift === true) {
    await Gift.updateMany(
      { _id: { $ne: req.params.id }, isWelcomeGift: true },
      { $set: { isWelcomeGift: false } },
    );
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
  const updatable = ['goldConversionRatio', 'diamondPackages', 'withdraw', 'announcements', 'landing'];
  for (const key of updatable) if (key in req.body) (settings as any)[key] = req.body[key];
  if (req.body.rates && typeof req.body.rates === 'object') {
    Object.assign(settings.rates, req.body.rates);
  }
  if (req.body.features && typeof req.body.features === 'object') {
    Object.assign(settings.features, req.body.features);
  }
  await settings.save();
  return ok(res, settings, 'Settings updated');
});

/** GET /admin/hosts — approved hosts with pricing + ratings for admin management. */
export const listHostsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { q } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = { role: Role.Host, isHostApproved: true };
  if (q) {
    filter.$or = [
      { email: new RegExp(q, 'i') },
      { username: new RegExp(q, 'i') },
      { displayName: new RegExp(q, 'i') },
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ averageRating: -1, totalReviews: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items.map((u) => (u as any).toPublic()), page, limit, total));
});

/** PATCH /admin/hosts/:id/pricing — set per-host video/audio/message gold prices. */
export const updateHostPricing = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== Role.Host) throw ApiError.badRequest('User is not a host');

  const { videoPrice, audioPrice, messagePrice } = req.body as {
    videoPrice?: number;
    audioPrice?: number;
    messagePrice?: number;
  };
  if (videoPrice != null) user.videoPrice = Math.max(0, videoPrice);
  if (audioPrice != null) user.audioPrice = Math.max(0, audioPrice);
  if (messagePrice != null) user.messagePrice = Math.max(0, messagePrice);
  await user.save();
  return ok(res, (user as any).toPublic(), 'Host pricing updated');
});

/** PATCH /admin/hosts/:id/popular — mark/unmark a user or host as popular on the homepage. */
export const updateHostPopular = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === Role.Admin) {
    throw ApiError.badRequest('Admin accounts cannot be marked popular');
  }
  if (user.role === Role.Host && !user.isHostApproved) {
    throw ApiError.badRequest('Only approved hosts (or normal users) can be marked popular');
  }
  if (user.role !== Role.User && user.role !== Role.Host) {
    throw ApiError.badRequest('Only normal users or hosts can be marked popular');
  }

  const { isPopularHost, popularSortOrder } = req.body as {
    isPopularHost?: boolean;
    popularSortOrder?: number;
  };
  if (typeof isPopularHost === 'boolean') user.isPopularHost = isPopularHost;
  if (popularSortOrder != null) user.popularSortOrder = Math.max(0, popularSortOrder);
  if (!user.isPopularHost) user.popularSortOrder = 0;
  await user.save();
  return ok(res, (user as any).toPublic(), 'Popular profile updated');
});

/** GET /admin/reviews — moderate host reviews. */
export const listReviewsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { hostId, hidden } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (hostId) filter.host = hostId;
  if (hidden === 'true') filter.isHidden = true;
  if (hidden === 'false') filter.isHidden = false;

  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reviewer', 'displayName username avatarUrl emailVerified')
      .populate('host', 'displayName username'),
    Review.countDocuments(filter),
  ]);

  return ok(
    res,
    buildPaginated(
      items.map((r) => {
        const hostDoc = r.host as any;
        return {
          ...serializeReview(r as any),
          isHidden: r.isHidden,
          host:
            hostDoc && typeof hostDoc === 'object' && hostDoc._id
              ? {
                  id: hostDoc._id.toString(),
                  displayName: hostDoc.displayName,
                  username: hostDoc.username,
                }
              : { id: String(r.host) },
        };
      }),
      page,
      limit,
      total,
    ),
  );
});

/** DELETE /admin/reviews/:id — permanently remove abusive review. */
export const deleteReviewAdmin = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');
  const hostId = review.host;
  await review.deleteOne();
  await recomputeHostRating(hostId);
  return ok(res, null, 'Review deleted');
});

/** PATCH /admin/reviews/:id — hide/unhide a review. */
export const patchReviewAdmin = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');
  if (typeof req.body.isHidden === 'boolean') review.isHidden = req.body.isHidden;
  await review.save();
  await recomputeHostRating(review.host);
  return ok(res, serializeReview(review as any), 'Review updated');
});

// --------------------------------------------------------------------------
// Contact inquiries
// --------------------------------------------------------------------------
export const listInquiries = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    ContactInquiry.find(filter)
      .populate('user', 'displayName username email avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ContactInquiry.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

export const replyInquiry = asyncHandler(async (req: Request, res: Response) => {
  const { adminReply, status, adminNote } = req.body;
  const inquiry = await ContactInquiry.findById(req.params.id);
  if (!inquiry) throw ApiError.notFound('Inquiry not found');

  if (adminReply !== undefined) inquiry.adminReply = adminReply;
  if (adminNote !== undefined) inquiry.adminNote = adminNote;
  if (status) inquiry.status = status;
  await inquiry.save();
  return ok(res, inquiry, 'Inquiry updated');
});

export const deleteInquiry = asyncHandler(async (req: Request, res: Response) => {
  const inquiry = await ContactInquiry.findByIdAndDelete(req.params.id);
  if (!inquiry) throw ApiError.notFound('Inquiry not found');
  return ok(res, null, 'Inquiry removed');
});

// --------------------------------------------------------------------------
// Online users (presence)
// --------------------------------------------------------------------------
export const listOnlineUsers = asyncHandler(async (req: Request, res: Response) => {
  const { q, role } = req.query as Record<string, string>;
  await sweepStalePresence();

  const cutoff = new Date(Date.now() - PRESENCE_ONLINE_MS);
  const filter: Record<string, unknown> = {
    status: AccountStatus.Active,
    $or: [{ isOnline: true, lastSeenAt: { $gte: cutoff } }, { lastSeenAt: { $gte: cutoff } }],
  };
  if (role === Role.User || role === Role.Host) {
    filter.role = role;
  } else {
    filter.role = { $in: [Role.User, Role.Host] };
  }
  if (q) {
    filter.$and = [
      {
        $or: [
          { displayName: new RegExp(q, 'i') },
          { username: new RegExp(q, 'i') },
          { email: new RegExp(q, 'i') },
        ],
      },
    ];
  }

  const users = await User.find(filter).sort({ displayName: 1 }).limit(200);
  const profiles = await Profile.find({ user: { $in: users.map((u) => u._id) } }).select(
    'user locationLabel city country',
  );
  const profileByUser = new Map(profiles.map((p) => [p.user.toString(), p]));

  const items = users.map((u) => {
    const profile = profileByUser.get(u._id.toString());
    const locationLabel =
      profile?.locationLabel ||
      [profile?.city, profile?.country].filter(Boolean).join(', ') ||
      u.country ||
      'Location not set';
    return {
      ...(u as any).toPublic(),
      locationLabel,
    };
  });

  return ok(res, { items, total: items.length });
});

// --------------------------------------------------------------------------
// Admin diamond grants
// --------------------------------------------------------------------------
export const grantDiamonds = asyncHandler(async (req: Request, res: Response) => {
  const { userId, amount, note } = req.body as {
    userId: string;
    amount: number;
    note?: string;
  };
  if (!userId) throw ApiError.badRequest('userId is required');
  const diamonds = Number(amount);
  if (!Number.isFinite(diamonds) || diamonds <= 0 || diamonds > 1_000_000) {
    throw ApiError.badRequest('Amount must be between 1 and 1,000,000');
  }

  const target = await User.findById(userId);
  if (!target) throw ApiError.notFound('User not found');
  if (target.role === Role.Admin) {
    throw ApiError.badRequest('Cannot grant diamonds to an admin account');
  }

  const admin = await User.findById(req.user!.id).select('email displayName');
  const wallet = await creditDiamonds({
    userId: target._id,
    amount: Math.floor(diamonds),
    reason: DiamondTxnReason.AdminAdjust,
    meta: {
      adminId: req.user!.id,
      adminEmail: admin?.email,
      adminName: admin?.displayName,
      note: note?.trim() || undefined,
    },
  });

  await notify({
    userId: target._id.toString(),
    type: NotificationType.Announcement,
    title: 'Diamonds received',
    body: `An admin added ${Math.floor(diamonds)} diamonds to your wallet.`,
    data: { amount: Math.floor(diamonds) },
  });

  return ok(
    res,
    {
      user: (target as any).toPublic(),
      diamondsGranted: Math.floor(diamonds),
      balance: wallet.diamonds,
    },
    `Granted ${Math.floor(diamonds)} diamonds`,
  );
});

export const listDiamondGrants = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {
    reason: DiamondTxnReason.AdminAdjust,
    direction: LedgerDirection.Credit,
  };

  const [items, total] = await Promise.all([
    DiamondTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'displayName username email avatarUrl role'),
    DiamondTransaction.countDocuments(filter),
  ]);

  return ok(
    res,
    buildPaginated(
      items.map((txn) => ({
        id: txn._id.toString(),
        amount: txn.amount,
        balanceAfter: txn.balanceAfter,
        note: (txn.meta as any)?.note,
        adminId: (txn.meta as any)?.adminId,
        adminEmail: (txn.meta as any)?.adminEmail,
        user: txn.user,
        createdAt: txn.createdAt,
      })),
      page,
      limit,
      total,
    ),
  );
});
