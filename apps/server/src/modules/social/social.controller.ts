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

/**
 * Create — or revive — the match for a mutual pair.
 *
 * This cannot be an upsert keyed on `{ users: { $all: [a, b] } }`: while
 * building the document to insert, MongoDB expands `$all` into one predicate
 * per element and refuses with "cannot infer query fields to set, path 'users'
 * is matched twice". Every mutual like therefore failed and no match was ever
 * stored, which is why the matches page stayed empty.
 */
async function ensureMatch(a: string, b: string): Promise<void> {
  const users = [new Types.ObjectId(a), new Types.ObjectId(b)].sort();
  // Reading with `$all` stays order-independent, so pairs written before the
  // ids were sorted are still found instead of being duplicated.
  const pair = { users: { $all: users, $size: 2 } };

  const existing = await Match.findOne(pair).select('_id active');
  if (existing) {
    if (!existing.active) {
      await Match.updateOne(
        { _id: existing._id },
        { $set: { active: true, matchedAt: new Date() } },
      );
    }
    return;
  }

  try {
    await Match.create({ users, matchedAt: new Date(), active: true });
  } catch (err) {
    // Both sides can like in the same instant; if the other request won the
    // race the pair now exists and there is nothing left to do.
    if (!(await Match.exists(pair))) throw err;
  }
}

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
    await ensureMatch(me, target);
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
  await Match.updateOne({ users: { $all: users, $size: 2 } }, { $set: { active: false } });
  return ok(res, null, 'Unliked');
});

/**
 * Recreate matches for pairs that already like each other but have no match.
 *
 * Every mutual like taken while the upsert above was broken left two Like rows
 * and no Match. Neither side is offered the other on Discover again, so those
 * pairs can never re-trigger the match themselves — repair them on read.
 */
async function backfillMissingMatches(userId: string): Promise<void> {
  const uid = new Types.ObjectId(userId);
  const [outgoing, incoming, existing] = await Promise.all([
    Like.find({ from: uid }).select('to').lean(),
    Like.find({ to: uid }).select('from').lean(),
    Match.find({ users: uid }).select('users active').lean(),
  ]);

  const likedByMe = new Set(outgoing.map((l) => l.to.toString()));
  const mutual = incoming.map((l) => l.from.toString()).filter((id) => likedByMe.has(id));
  if (!mutual.length) return;

  const matchedWith = new Set(
    existing
      .filter((m) => m.active)
      .map((m) => m.users.find((u) => u.toString() !== userId)?.toString())
      .filter(Boolean) as string[],
  );

  for (const other of mutual) {
    if (!matchedWith.has(other)) await ensureMatch(userId, other);
  }
}

/** GET /social/matches — list active matches for the current user. */
export const listMatches = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  await backfillMissingMatches(req.user!.id);
  const filter = { users: req.user!.id, active: true };
  const [matches, total] = await Promise.all([
    Match.find(filter).sort({ matchedAt: -1 }).skip(skip).limit(limit).populate('users'),
    Match.countDocuments(filter),
  ]);
  // Return the "other" user in each match for convenience, in the same public
  // shape (`id`, not `_id`) every other user-returning endpoint uses.
  const items = matches
    .map((m) => {
      const other = (m.users as any[]).find((u) => u?._id?.toString() !== req.user!.id);
      if (!other) return null;
      return { matchId: m._id.toString(), matchedAt: m.matchedAt, user: other.toPublic() };
    })
    .filter(Boolean);
  return ok(res, buildPaginated(items, page, limit, total));
});

/** GET /social/likes — users who liked me (incoming). */
export const listLikers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { to: req.user!.id };
  const [likes, total] = await Promise.all([
    Like.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('from'),
    Like.countDocuments(filter),
  ]);
  const items = likes.map((l) => l.from as any).filter(Boolean).map((u) => u.toPublic());
  return ok(res, buildPaginated(items, page, limit, total));
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
    Follower.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('following'),
    Follower.countDocuments(filter),
  ]);
  const items = rows.map((r) => r.following as any).filter(Boolean).map((u) => u.toPublic());
  return ok(res, buildPaginated(items, page, limit, total));
});
