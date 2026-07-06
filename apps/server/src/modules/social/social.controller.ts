import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { NotificationType, Role } from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { Follower, Like, Match, Profile, User } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { notify } from '../../services/notification.service';
import { assertUsersCanConnect } from '../../services/location.service';

/** POST /social/like/:userId — like a user; creates a Match if mutual. */
export const likeUser = asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const target = req.params.userId;
  if (me === target) throw ApiError.badRequest('You cannot like yourself');

  await assertUsersCanConnect(me, target);

  const targetUser = await User.findById(target).select('displayName');
  if (!targetUser) throw ApiError.notFound('User not found');

  await Like.updateOne({ from: me, to: target }, { $setOnInsert: { from: me, to: target } }, { upsert: true });
  await Profile.updateOne({ user: target }, { $inc: { 'stats.likesReceived': 1 } }, { upsert: true });

  // Check for a reciprocal like -> match.
  const reciprocal = await Like.exists({ from: target, to: me });
  let matched = false;
  if (reciprocal) {
    const users = [new Types.ObjectId(me), new Types.ObjectId(target)].sort();
    await Match.updateOne(
      { users: { $all: users } },
      { $setOnInsert: { users, matchedAt: new Date(), active: true } },
      { upsert: true },
    );
    matched = true;
    await notify({
      userId: target,
      actor: me,
      type: NotificationType.Match,
      title: "It's a match! 🎉",
      body: `You and ${(await User.findById(me))?.displayName} liked each other`,
    });
    await notify({
      userId: me,
      actor: target,
      type: NotificationType.Match,
      title: "It's a match! 🎉",
      body: `You and ${targetUser.displayName} liked each other`,
    });
  } else {
    await notify({
      userId: target,
      actor: me,
      type: NotificationType.Like,
      title: 'Someone likes you 💖',
      body: 'Open Kushlov to find out who',
    });
  }

  return created(res, { matched }, matched ? "It's a match!" : 'Liked');
});

/** DELETE /social/like/:userId — remove a like (and any resulting match). */
export const unlikeUser = asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const target = req.params.userId;
  await Like.deleteOne({ from: me, to: target });
  const users = [new Types.ObjectId(me), new Types.ObjectId(target)].sort();
  await Match.updateOne({ users: { $all: users } }, { active: false });
  return ok(res, null, 'Unliked');
});

/** GET /social/matches — list active matches for the current user. */
export const listMatches = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { users: req.user!.id, active: true };
  const [matches, total] = await Promise.all([
    Match.find(filter)
      .sort({ matchedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('users', 'displayName username avatarUrl isOnline'),
    Match.countDocuments(filter),
  ]);
  // Return the "other" user in each match for convenience.
  const items = matches.map((m) => {
    const other = (m.users as any[]).find((u) => u._id.toString() !== req.user!.id);
    return { matchId: m._id, matchedAt: m.matchedAt, user: other };
  });
  return ok(res, buildPaginated(items, page, limit, total));
});

/** GET /social/likes — users who liked me (incoming). */
export const listLikers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { to: req.user!.id };
  const [likes, total] = await Promise.all([
    Like.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('from', 'displayName username avatarUrl isOnline'),
    Like.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(likes.map((l) => l.from), page, limit, total));
});

/** POST /social/follow/:userId — follow a host. */
export const followUser = asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const target = req.params.userId;
  if (me === target) throw ApiError.badRequest('You cannot follow yourself');

  await assertUsersCanConnect(me, target);

  const targetUser = await User.findById(target);
  if (!targetUser) throw ApiError.notFound('User not found');

  const result = await Follower.updateOne(
    { follower: me, following: target },
    { $setOnInsert: { follower: me, following: target } },
    { upsert: true },
  );

  if (result.upsertedCount) {
    await Profile.updateOne({ user: target }, { $inc: { 'stats.followers': 1 } }, { upsert: true });
    await Profile.updateOne({ user: me }, { $inc: { 'stats.following': 1 } }, { upsert: true });
    await notify({
      userId: target,
      actor: me,
      type: NotificationType.Follower,
      title: 'New follower',
      body: `${(await User.findById(me))?.displayName} started following you`,
    });
  }
  return created(res, null, 'Followed');
});

/** DELETE /social/follow/:userId — unfollow. */
export const unfollowUser = asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const target = req.params.userId;
  const result = await Follower.deleteOne({ follower: me, following: target });
  if (result.deletedCount) {
    await Profile.updateOne({ user: target }, { $inc: { 'stats.followers': -1 } });
    await Profile.updateOne({ user: me }, { $inc: { 'stats.following': -1 } });
  }
  return ok(res, null, 'Unfollowed');
});

/** GET /social/following — hosts the current user follows. */
export const listFollowing = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { follower: req.user!.id };
  const [rows, total] = await Promise.all([
    Follower.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('following', 'displayName username avatarUrl isOnline role isHostApproved'),
    Follower.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(rows.map((r) => r.following), page, limit, total));
});
