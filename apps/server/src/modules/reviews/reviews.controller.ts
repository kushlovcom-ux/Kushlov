import { Request, Response } from 'express';
import { Role } from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { Review, User } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, ok } from '../../utils/response';
import { getSettings } from '../../services/settings.service';
import { assertUsersCanConnect } from '../../services/location.service';
import { recomputeHostRating, serializeReview } from '../../services/review.service';
import { isApprovedHost } from '../../services/pricing.service';

/** POST /reviews — normal user creates or updates their review for a host. */
export const upsertReview = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getSettings();
  if (!settings.features.reviewsEnabled) {
    throw ApiError.forbidden('Reviews are currently disabled');
  }

  if (req.user!.role !== Role.User) {
    throw ApiError.forbidden('Only normal users can review hosts');
  }

  const { hostId, rating, text } = req.body as {
    hostId: string;
    rating: number;
    text?: string;
  };

  const host = await User.findById(hostId).select('role isHostApproved');
  if (!host || !isApprovedHost(host)) {
    throw ApiError.badRequest('You can only review approved hosts');
  }

  await assertUsersCanConnect(req.user!.id, hostId);

  const existing = await Review.findOne({ host: hostId, reviewer: req.user!.id });
  if (existing) {
    existing.rating = rating;
    existing.text = (text ?? '').trim();
    existing.isHidden = false;
    await existing.save();
    await recomputeHostRating(hostId);
    const populated = await existing.populate(
      'reviewer',
      'displayName username avatarUrl emailVerified',
    );
    return ok(res, serializeReview(populated as any), 'Review updated');
  }

  const review = await Review.create({
    host: hostId,
    reviewer: req.user!.id,
    rating,
    text: (text ?? '').trim(),
  });
  await recomputeHostRating(hostId);
  const populated = await review.populate(
    'reviewer',
    'displayName username avatarUrl emailVerified',
  );
  return created(res, serializeReview(populated as any), 'Review submitted');
});

/** PUT /reviews/:id — edit own review. */
export const updateReview = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getSettings();
  if (!settings.features.reviewsEnabled) {
    throw ApiError.forbidden('Reviews are currently disabled');
  }

  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');
  if (review.reviewer.toString() !== req.user!.id) {
    throw ApiError.forbidden('You can only edit your own review');
  }
  if (req.user!.role !== Role.User) {
    throw ApiError.forbidden('Only normal users can review hosts');
  }

  const { rating, text } = req.body as { rating?: number; text?: string };
  if (rating != null) review.rating = rating;
  if (text != null) review.text = text.trim();
  review.isHidden = false;
  await review.save();
  await recomputeHostRating(review.host);
  const populated = await review.populate(
    'reviewer',
    'displayName username avatarUrl emailVerified',
  );
  return ok(res, serializeReview(populated as any), 'Review updated');
});

/** DELETE /reviews/:id — author deletes own review (or admin via admin routes). */
export const deleteOwnReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');
  if (review.reviewer.toString() !== req.user!.id && req.user!.role !== Role.Admin) {
    throw ApiError.forbidden('Not allowed');
  }
  const hostId = review.host;
  await review.deleteOne();
  await recomputeHostRating(hostId);
  return ok(res, null, 'Review deleted');
});

/** GET /reviews/host/:hostId — public list of reviews for a host. */
export const listHostReviews = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const hostId = req.params.hostId;
  const host = await User.findById(hostId).select(
    'role isHostApproved averageRating totalReviews displayName',
  );
  if (!host) throw ApiError.notFound('Host not found');

  const filter = { host: hostId, isHidden: false };
  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reviewer', 'displayName username avatarUrl emailVerified'),
    Review.countDocuments(filter),
  ]);

  return ok(res, {
    ...buildPaginated(
      items.map((r) => serializeReview(r as any)),
      page,
      limit,
      total,
    ),
    summary: {
      averageRating: host.averageRating ?? 0,
      totalReviews: host.totalReviews ?? 0,
    },
    myReviewId: null as string | null,
  });
});

/** GET /reviews/mine/:hostId — current user's review for a host (if any). */
export const getMyReviewForHost = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findOne({
    host: req.params.hostId,
    reviewer: req.user!.id,
  }).populate('reviewer', 'displayName username avatarUrl emailVerified');
  if (!review) return ok(res, null);
  return ok(res, serializeReview(review as any));
});
