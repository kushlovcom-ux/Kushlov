import { Request, Response } from 'express';
import {
  DiamondTxnReason,
  GoldTxnReason,
  LiveStatus,
  NotificationType,
  SocketEvents,
} from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { Follower, Gift, LiveChat, LiveParticipant, LiveStream } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { createLiveKitToken, closeRoom, removeParticipant } from '../../services/livekit.service';
import { uploadBuffer } from '../../services/media.service';
import { spendDiamonds } from '../../services/wallet.service';
import { getSettings } from '../../services/settings.service';
import { notify } from '../../services/notification.service';
import { emitToRoom } from '../../socket/io';
import { assertUsersCanConnect, getDiscoverableUserIds } from '../../services/location.service';
import { refId } from '../../utils/refId';
import { getLiveKitPublicUrl } from '../../config/env';

const roomOf = (id: string) => `live:${id}`;

/** POST /live/start — approved host goes live. */
export const startLive = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getSettings();
  if (!settings.features.liveEnabled) throw ApiError.forbidden('Live streaming is disabled');

  const roomName = `live_${req.user!.id}_${Date.now()}`;
  let thumbnailUrl: string | undefined;
  let thumbnailPublicId: string | undefined;
  if (req.file) {
    const media = await uploadBuffer(req.file, `live/${req.user!.id}/thumbnails`);
    thumbnailUrl = media.url;
    thumbnailPublicId = media.publicId;
  }

  const live = await LiveStream.create({
    host: req.user!.id,
    title: req.body.title ?? 'Live now',
    roomName,
    thumbnailUrl,
    thumbnailPublicId,
    status: LiveStatus.Live,
    startedAt: new Date(),
  });

  const token = await createLiveKitToken({
    identity: req.user!.id,
    roomName,
    canPublish: true,
    canPublishData: true,
  });

  // Notify followers that the host is live.
  const followers = await Follower.find({ following: req.user!.id }).distinct('follower');
  await Promise.all(
    followers.map((f) =>
      notify({
        userId: f,
        actor: req.user!.id,
        type: NotificationType.LiveStarted,
        title: 'A host you follow is live 🔴',
        body: live.title,
        data: { liveId: live._id.toString() },
      }),
    ),
  );

  return created(res, { live, token, roomName, livekitUrl: getLiveKitPublicUrl() }, 'You are live');
});

/** GET /live/:id/host-token — the owning host (re)joins their own room to publish. */
export const hostToken = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound('Stream not found');
  if (live.host.toString() !== req.user!.id) throw ApiError.forbidden('Not your stream');

  const token = await createLiveKitToken({
    identity: req.user!.id,
    roomName: live.roomName,
    canPublish: true,
    canPublishData: true,
  });
  return ok(res, { token, roomName: live.roomName, livekitUrl: getLiveKitPublicUrl() });
});

/** POST /live/:id/end — host ends the stream. */
export const endLive = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound('Stream not found');
  if (live.host.toString() !== req.user!.id) throw ApiError.forbidden('Not your stream');

  live.status = LiveStatus.Ended;
  live.endedAt = new Date();
  await live.save();
  await closeRoom(live.roomName);
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveLeave, { ended: true });
  return ok(res, live, 'Stream ended');
});

/** GET /live — list currently live streams (hosts within discovery radius). */
export const listLive = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const discoverableIds = await getDiscoverableUserIds(req.user!.id);
  const filter = { status: LiveStatus.Live, host: { $in: discoverableIds } };
  const [items, total] = await Promise.all([
    LiveStream.find(filter)
      .sort({ viewerCount: -1, startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('host', 'displayName username avatarUrl isHostApproved'),
    LiveStream.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

/** GET /live/:id — stream details. */
export const getLive = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id).populate(
    'host',
    'displayName username avatarUrl isHostApproved',
  );
  if (!live) throw ApiError.notFound('Stream not found');
  const hostId = refId(live.host as Parameters<typeof refId>[0]);
  if (hostId !== req.user!.id) {
    await assertUsersCanConnect(req.user!.id, hostId);
  }
  return ok(res, live);
});

/** POST /live/:id/join — viewer joins and receives a subscribe-only token. */
export const joinLive = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== LiveStatus.Live) throw ApiError.notFound('Stream is not live');
  if (live.host.toString() !== req.user!.id) {
    await assertUsersCanConnect(req.user!.id, live.host.toString());
  }
  if (live.bannedUsers.some((u) => u.toString() === req.user!.id)) {
    throw ApiError.forbidden('You are banned from this stream');
  }

  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.user!.id },
    { $set: { joinedAt: new Date(), leftAt: undefined, role: 'viewer' } },
    { upsert: true },
  );
  const viewerCount = await LiveParticipant.countDocuments({
    liveStream: live._id,
    leftAt: { $exists: false },
  });
  live.viewerCount = viewerCount;
  live.peakViewers = Math.max(live.peakViewers, viewerCount);
  await live.save();

  const token = await createLiveKitToken({
    identity: req.user!.id,
    roomName: live.roomName,
    canPublish: false,
    canSubscribe: true,
    canPublishData: true,
  });

  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveViewerCount, { viewerCount });
  return ok(res, { token, roomName: live.roomName, viewerCount, livekitUrl: getLiveKitPublicUrl() });
});

/** POST /live/:id/leave — viewer leaves. */
export const leaveLive = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound('Stream not found');
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.user!.id },
    { $set: { leftAt: new Date() } },
  );
  const viewerCount = await LiveParticipant.countDocuments({
    liveStream: live._id,
    leftAt: { $exists: false },
  });
  live.viewerCount = viewerCount;
  await live.save();
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveViewerCount, { viewerCount });
  return ok(res, { viewerCount });
});

/** POST /live/:id/chat — send a live chat message (billed per message). */
export const liveChat = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== LiveStatus.Live) throw ApiError.notFound('Stream is not live');

  const settings = await getSettings();
  const cost = settings.rates.liveChatPerMessage;
  if (cost > 0 && live.host.toString() !== req.user!.id) {
    await spendDiamonds({
      userId: req.user!.id,
      hostId: live.host,
      amount: cost,
      diamondReason: DiamondTxnReason.LiveChat,
      goldReason: GoldTxnReason.LiveChat,
      reference: live._id,
      referenceModel: 'LiveStream',
    });
  }

  const chat = await LiveChat.create({
    liveStream: live._id,
    user: req.user!.id,
    message: req.body.message,
  });
  const populated = await chat.populate('user', 'displayName username avatarUrl');
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveChat, populated);
  return created(res, populated);
});

/** POST /live/:id/like — like the stream. */
export const likeLive = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findByIdAndUpdate(
    req.params.id,
    { $inc: { totalLikes: 1 } },
    { new: true },
  );
  if (!live) throw ApiError.notFound('Stream not found');
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveViewerCount, {
    totalLikes: live.totalLikes,
  });
  return ok(res, { totalLikes: live.totalLikes });
});

/** POST /live/:id/gift — send a gift inside the stream to the host. */
export const liveGift = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== LiveStatus.Live) throw ApiError.notFound('Stream is not live');
  const gift = await Gift.findOne({ _id: req.body.giftId, isActive: true });
  if (!gift) throw ApiError.notFound('Gift not found');

  const result = await spendDiamonds({
    userId: req.user!.id,
    hostId: live.host,
    amount: gift.diamondCost,
    diamondReason: DiamondTxnReason.Gift,
    goldReason: GoldTxnReason.Gift,
    reference: gift._id,
    referenceModel: 'Gift',
    meta: { liveId: live._id.toString() },
  });
  live.totalGiftsGold += result.goldEarned;
  await live.save();

  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveGift, {
    gift,
    from: req.user!.id,
    gold: result.goldEarned,
  });
  return created(res, { gift, ...result });
});

/** POST /live/:id/ban/:userId — host/moderator bans a viewer. */
export const banFromLive = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound('Stream not found');
  const isModerator =
    live.host.toString() === req.user!.id ||
    live.moderators.some((m) => m.toString() === req.user!.id);
  if (!isModerator) throw ApiError.forbidden('Only host/moderators can ban');

  await LiveStream.updateOne({ _id: live._id }, { $addToSet: { bannedUsers: req.params.userId } });
  await removeParticipant(live.roomName, req.params.userId);
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.params.userId },
    { $set: { leftAt: new Date() } },
  );
  return ok(res, null, 'User banned from stream');
});

/** POST /live/:id/moderator/:userId — host assigns a moderator. */
export const addModerator = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound('Stream not found');
  if (live.host.toString() !== req.user!.id) throw ApiError.forbidden('Only host can add moderators');
  await LiveStream.updateOne({ _id: live._id }, { $addToSet: { moderators: req.params.userId } });
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.params.userId },
    { $set: { role: 'moderator' } },
  );
  return ok(res, null, 'Moderator added');
});
