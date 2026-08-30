import { Request, Response } from 'express';
import {
  DiamondTxnReason,
  GoldTxnReason,
  LiveStatus,
  NotificationType,
  Role,
  SocketEvents,
} from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { Follower, Gift, LiveChat, LiveParticipant, LiveStream, User, Block } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import {
  createLiveKitToken,
  closeRoom,
  removeParticipant,
} from '../../services/livekit.service';
import {
  markLiveEnded,
  endOpenLivesForHost,
  pruneStaleLiveStreams,
} from '../../services/live-lifecycle.service';
import { uploadBuffer } from '../../services/media.service';
import { spendDiamonds } from '../../services/wallet.service';
import { getSettings } from '../../services/settings.service';
import { notify } from '../../services/notification.service';
import { emitToRoom, emitToUser } from '../../socket/io';
import { assertUsersCanConnect, getDiscoverableUserIds } from '../../services/location.service';
import { refId } from '../../utils/refId';
import { getLiveKitPublicUrl } from '../../config/env';

const roomOf = (id: string) => `live:${id}`;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function countActiveViewers(liveId: unknown): Promise<number> {
  return LiveParticipant.countDocuments({
    liveStream: liveId,
    leftAt: { $exists: false },
    role: { $ne: 'host' },
  });
}

function serializeLiveChat(doc: {
  _id?: { toString(): string };
  message?: string;
  createdAt?: Date;
  user?: {
    _id?: { toString(): string };
    id?: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
  };
}) {
  const user = doc.user;
  return {
    _id: doc._id?.toString?.(),
    message: doc.message ?? '',
    createdAt: doc.createdAt,
    user: {
      id: user?.id ?? user?._id?.toString?.(),
      displayName: user?.displayName ?? 'User',
      username: user?.username,
      avatarUrl: user?.avatarUrl,
    },
  };
}

/** Broadcast to the live socket room, host/co-host, and active participants (user rooms). */
async function emitLiveEvent(
  live: {
    _id: { toString(): string };
    host: Parameters<typeof refId>[0];
    coHost?: Parameters<typeof refId>[0] | null;
  },
  event: string,
  payload: unknown,
) {
  const liveId = live._id.toString();
  emitToRoom(roomOf(liveId), event, payload);

  const targets = new Set<string>();
  targets.add(refId(live.host));
  if (live.coHost) targets.add(refId(live.coHost));

  // Fan out to every active participant so chat works even if a client
  // missed `live:join` / dropped out of the socket room briefly.
  try {
    const participants = await LiveParticipant.find({
      liveStream: live._id,
      leftAt: { $exists: false },
    })
      .select('user')
      .lean();
    for (const p of participants) {
      targets.add(refId(p.user as Parameters<typeof refId>[0]));
    }
  } catch {
    /* room + host emit already attempted */
  }

  for (const userId of targets) {
    emitToUser(userId, event, payload);
  }
}

/** POST /live/start — approved host goes live. */
export const startLive = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getSettings();
  if (!settings.features.liveEnabled) throw ApiError.forbidden('Live streaming is disabled');

  // One active stream per host — close any leftovers from a prior session.
  await endOpenLivesForHost(req.user!.id);

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

  const viewerCount = await countActiveViewers(live._id);
  live.viewerCount = viewerCount;
  await live.save();

  // Keep host in participant set so chat fan-out always includes them.
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.user!.id },
    {
      $set: { joinedAt: new Date(), role: 'host' },
      $unset: { leftAt: '' },
    },
    { upsert: true },
  );

  const hostUser = await User.findById(req.user!.id).select('displayName');
  const token = await createLiveKitToken({
    identity: req.user!.id,
    name: hostUser?.displayName ?? 'Host',
    roomName: live.roomName,
    canPublish: true,
    canPublishData: true,
    metadata: { role: 'host' },
  });
  return ok(res, {
    token,
    roomName: live.roomName,
    livekitUrl: getLiveKitPublicUrl(),
    viewerCount,
  });
});

/**
 * GET /live/:id/preview-token — subscribe-only token for muted card previews.
 * Does not create a LiveParticipant or bump viewerCount.
 */
export const previewToken = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== LiveStatus.Live) throw ApiError.notFound('Stream is not live');
  if (live.host.toString() !== req.user!.id) {
    await assertUsersCanConnect(req.user!.id, live.host.toString());
  }
  if (live.bannedUsers.some((u) => u.toString() === req.user!.id)) {
    throw ApiError.forbidden('You are banned from this stream');
  }

  const token = await createLiveKitToken({
    identity: `preview_${req.user!.id}_${live._id.toString()}`,
    roomName: live.roomName,
    canPublish: false,
    canSubscribe: true,
    canPublishData: false,
    ttlSeconds: 120,
  });
  return ok(res, { token, roomName: live.roomName, livekitUrl: getLiveKitPublicUrl() });
});

/** POST /live/:id/end — host ends the stream. */
export const endLive = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound('Stream not found');
  if (live.host.toString() !== req.user!.id) throw ApiError.forbidden('Not your stream');

  await markLiveEnded(live);
  return ok(res, live, 'Stream ended');
});

/** GET /live — list currently live streams.
 *  Browse: hosts outside the ~10 km exclusion zone (same privacy as Discover).
 *  Search (?q=): match host name/username or title, including nearby hosts —
 *  locals who type the host's name can find and join the stream.
 */
export const listLive = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  await pruneStaleLiveStreams();

  const blocked = await Block.find({ blocker: req.user!.id }).distinct('blocked');
  const exclude = [...blocked.map(String), req.user!.id];

  const filter: Record<string, unknown> = {
    status: LiveStatus.Live,
    host: { $nin: exclude },
  };

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const matchedHosts = await User.find({
      _id: { $nin: exclude },
      $or: [{ displayName: rx }, { username: rx }],
    }).distinct('_id');
    filter.$or = [{ host: { $in: matchedHosts } }, { title: rx }];
  } else {
    const discoverableIds = await getDiscoverableUserIds(req.user!.id, blocked);
    filter.host = { $in: discoverableIds };
  }

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
  const live = await LiveStream.findById(req.params.id)
    .populate('host', 'displayName username avatarUrl isHostApproved')
    .populate('coHost', 'displayName username avatarUrl isHostApproved');
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

  // Safety: co-host who races into /join still gets a publish token (group live).
  if (live.coHost?.toString() === req.user!.id) {
    const coHostUser = await User.findById(req.user!.id).select('displayName');
    await LiveParticipant.updateOne(
      { liveStream: live._id, user: req.user!.id },
      { $set: { joinedAt: new Date(), leftAt: undefined, role: 'cohost' } },
      { upsert: true },
    );
    const token = await createLiveKitToken({
      identity: req.user!.id,
      name: coHostUser?.displayName ?? 'Co-host',
      roomName: live.roomName,
      canPublish: true,
      canPublishData: true,
      metadata: { role: 'cohost' },
    });
    const viewerCount = await countActiveViewers(live._id);
    return ok(res, {
      token,
      roomName: live.roomName,
      viewerCount,
      livekitUrl: getLiveKitPublicUrl(),
      role: 'cohost',
    });
  }

  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.user!.id },
    {
      $set: { joinedAt: new Date(), role: 'viewer' },
      $unset: { leftAt: '' },
    },
    { upsert: true },
  );
  const viewerCount = await countActiveViewers(live._id);
  live.viewerCount = viewerCount;
  live.peakViewers = Math.max(live.peakViewers, viewerCount);
  await live.save();

  const viewer = await User.findById(req.user!.id).select('displayName');
  const token = await createLiveKitToken({
    identity: req.user!.id,
    name: viewer?.displayName,
    roomName: live.roomName,
    canPublish: false,
    canSubscribe: true,
    canPublishData: true,
    metadata: { role: 'viewer' },
  });

  await emitLiveEvent(live, SocketEvents.LiveViewerCount, { viewerCount });
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
  const viewerCount = await countActiveViewers(live._id);
  live.viewerCount = viewerCount;
  await live.save();
  await emitLiveEvent(live, SocketEvents.LiveViewerCount, { viewerCount });
  return ok(res, { viewerCount });
});

/** POST /live/:id/chat — send a live chat message (billed per message). */
export const liveChat = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== LiveStatus.Live) throw ApiError.notFound('Stream is not live');

  const settings = await getSettings();
  const cost = settings.rates.liveChatPerMessage ?? 0;
  const isPublisher =
    live.host.toString() === req.user!.id || live.coHost?.toString() === req.user!.id;
  if (cost > 0 && !isPublisher) {
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
  const payload = serializeLiveChat(populated as never);
  await emitLiveEvent(live, SocketEvents.LiveChat, payload);
  return created(res, payload);
});

/** GET /live/:id/chat — recent chat messages (polling fallback when sockets miss). */
export const listLiveChat = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id).select('_id status');
  if (!live) throw ApiError.notFound('Stream not found');

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const afterRaw = typeof req.query.after === 'string' ? req.query.after.trim() : '';
  const after =
    afterRaw && /^[a-fA-F0-9]{24}$/.test(afterRaw) ? afterRaw : null;

  const filter: Record<string, unknown> = { liveStream: live._id };
  if (after) {
    filter._id = { $gt: after };
  }

  const rows = await LiveChat.find(filter)
    .sort(after ? { _id: 1 } : { createdAt: -1 })
    .limit(limit)
    .populate('user', 'displayName username avatarUrl')
    .lean();

  const messages = (after ? rows : [...rows].reverse()).map((doc) =>
    serializeLiveChat(doc as never),
  );
  return ok(res, { messages });
});

/** POST /live/:id/like — like the stream. */
export const likeLive = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findByIdAndUpdate(
    req.params.id,
    { $inc: { totalLikes: 1 } },
    { new: true },
  );
  if (!live) throw ApiError.notFound('Stream not found');
  // Likes used to ride on `live:viewer_count`, which clients read as a viewer
  // update and ignored. Fan it out on its own event so hearts animate for
  // everyone, including a host that has not re-joined the socket room yet.
  await emitLiveEvent(live, SocketEvents.LiveLike, {
    liveId: live._id.toString(),
    userId: req.user!.id,
    totalLikes: live.totalLikes,
  });
  return ok(res, { totalLikes: live.totalLikes, likeCount: live.totalLikes });
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

/** GET /live/:id/viewers — host/moderator: who is currently watching. */
export const listViewers = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound('Stream not found');
  const isModerator =
    live.host.toString() === req.user!.id ||
    live.moderators.some((m) => m.toString() === req.user!.id);
  if (!isModerator) throw ApiError.forbidden('Only host/moderators can list viewers');

  const participants = await LiveParticipant.find({
    liveStream: live._id,
    leftAt: { $exists: false },
    role: { $ne: 'host' },
  })
    .sort({ joinedAt: -1 })
    .limit(100)
    .populate('user', 'displayName username avatarUrl');

  return ok(res, {
    viewerCount: await countActiveViewers(live._id),
    viewers: participants.map((p) => {
      const u = p.user as unknown as {
        _id?: { toString(): string };
        id?: string;
        displayName?: string;
        username?: string;
        avatarUrl?: string;
      };
      return {
        id: u?.id ?? u?._id?.toString?.() ?? String(p.user),
        displayName: u?.displayName,
        username: u?.username,
        avatarUrl: u?.avatarUrl,
        role: p.role,
        joinedAt: p.joinedAt,
      };
    }),
  });
});

const COLIVE_INVITE_TTL_MS = 60_000;

/** GET /live/colive/incoming — pending co-live invites for this host (HTTP fallback). */
export const listColiveIncoming = asyncHandler(async (req: Request, res: Response) => {
  const me = await User.findById(req.user!.id).select('role isHostApproved');
  // Normal users / unapproved hosts: empty list (clients may poll globally).
  if (!me || me.role !== Role.Host || !me.isHostApproved) {
    return ok(res, { items: [] });
  }

  const uid = req.user!.id;
  const cutoff = new Date(Date.now() - COLIVE_INVITE_TTL_MS);

  // Drop expired invites aimed at this user.
  await LiveStream.updateMany(
    {
      status: LiveStatus.Live,
      'pendingColiveInvite.inviteeId': uid,
      'pendingColiveInvite.invitedAt': { $lt: cutoff },
    },
    { $unset: { pendingColiveInvite: 1 } },
  );

  const lives = await LiveStream.find({
    status: LiveStatus.Live,
    coHost: { $exists: false },
    'pendingColiveInvite.inviteeId': uid,
    'pendingColiveInvite.invitedAt': { $gte: cutoff },
  })
    .select('title roomName host pendingColiveInvite')
    .populate('host', 'displayName avatarUrl username')
    .limit(5)
    .lean();

  const items = lives.map((live) => {
    const host = live.host as unknown as {
      _id?: { toString(): string };
      displayName?: string;
      avatarUrl?: string;
      username?: string;
    };
    return {
      liveId: live._id.toString(),
      roomName: live.roomName,
      title: live.title,
      invitedAt: live.pendingColiveInvite?.invitedAt,
      from: {
        id: host?._id?.toString?.(),
        displayName: host?.displayName,
        avatarUrl: host?.avatarUrl,
        username: host?.username,
      },
    };
  });

  return ok(res, { items });
});

/** POST /live/:id/colive/invite — host A invites another live host B into A's room (2A). */
export const coliveInvite = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== LiveStatus.Live) throw ApiError.notFound('Stream is not live');
  if (live.host.toString() !== req.user!.id) throw ApiError.forbidden('Only the host can invite');
  if (live.coHost) throw ApiError.badRequest('A co-host is already on this stream');

  const { hostId } = req.body as { hostId: string };
  if (!hostId || hostId === req.user!.id) throw ApiError.badRequest('Invalid hostId');

  const otherLive = await LiveStream.findOne({
    host: hostId,
    status: LiveStatus.Live,
  });
  if (!otherLive) throw ApiError.badRequest('That host is not currently live');

  const otherHost = await User.findById(hostId).select('displayName isHostApproved role');
  if (!otherHost?.isHostApproved) throw ApiError.forbidden('Only approved hosts can co-live');

  live.pendingColiveInvite = {
    inviteeId: hostId as unknown as typeof live.host,
    invitedAt: new Date(),
  };
  await live.save();

  const from = await User.findById(req.user!.id).select('displayName avatarUrl');
  const payload = {
    liveId: live._id.toString(),
    roomName: live.roomName,
    title: live.title,
    from: {
      id: from?._id.toString(),
      displayName: from?.displayName,
      avatarUrl: from?.avatarUrl,
    },
  };
  emitToUser(String(hostId), SocketEvents.LiveColiveInvite, payload);

  return ok(res, { invited: true }, 'Co-live invite sent');
});

/** POST /live/:id/colive/accept — invited host joins A's room as publisher; ends own stream. */
export const coliveAccept = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== LiveStatus.Live) throw ApiError.notFound('Stream is not live');
  if (live.host.toString() === req.user!.id) {
    throw ApiError.badRequest('You are already the host of this stream');
  }
  if (live.coHost && live.coHost.toString() !== req.user!.id) {
    throw ApiError.badRequest('A co-host is already on this stream');
  }

  const rejoining = live.coHost?.toString() === req.user!.id;

  if (!rejoining) {
    const pendingInvitee = live.pendingColiveInvite?.inviteeId?.toString();
    if (pendingInvitee && pendingInvitee !== req.user!.id) {
      throw ApiError.forbidden('This co-live invite is not for you');
    }

    // End invitee's own live stream if any.
    const own = await LiveStream.findOne({ host: req.user!.id, status: LiveStatus.Live });
    if (own) {
      await markLiveEnded(own);
    }

    live.coHost = req.user!.id as unknown as typeof live.coHost;
    await live.save();
    await LiveStream.updateOne({ _id: live._id }, { $unset: { pendingColiveInvite: 1 } });

    await LiveParticipant.updateOne(
      { liveStream: live._id, user: req.user!.id },
      { $set: { joinedAt: new Date(), leftAt: undefined, role: 'cohost' } },
      { upsert: true },
    );
  } else {
    await LiveStream.updateOne({ _id: live._id }, { $unset: { pendingColiveInvite: 1 } });
  }

  const coHost = await User.findById(req.user!.id).select('displayName avatarUrl username');
  const token = await createLiveKitToken({
    identity: req.user!.id,
    name: coHost?.displayName ?? 'Co-host',
    roomName: live.roomName,
    canPublish: true,
    canPublishData: true,
    metadata: { role: 'cohost' },
  });

  if (!rejoining) {
    emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveColiveAccept, {
      liveId: live._id.toString(),
      coHost: {
        id: coHost?._id.toString(),
        displayName: coHost?.displayName,
        avatarUrl: coHost?.avatarUrl,
        username: coHost?.username,
      },
    });
    emitToUser(live.host.toString(), SocketEvents.LiveColiveAccept, {
      liveId: live._id.toString(),
      coHost: {
        id: coHost?._id.toString(),
        displayName: coHost?.displayName,
        avatarUrl: coHost?.avatarUrl,
      },
    });
  }

  return ok(
    res,
    {
      token,
      roomName: live.roomName,
      livekitUrl: getLiveKitPublicUrl(),
      live,
      role: 'cohost',
    },
    rejoining ? 'Rejoined as co-host' : 'Joined as co-host',
  );
});

/** GET /live/:id/colive/token — co-host (re)joins the group live room to publish. */
export const coliveToken = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== LiveStatus.Live) throw ApiError.notFound('Stream is not live');
  if (live.coHost?.toString() !== req.user!.id) {
    throw ApiError.forbidden('You are not the co-host of this stream');
  }

  const coHost = await User.findById(req.user!.id).select('displayName');
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.user!.id },
    { $set: { joinedAt: new Date(), leftAt: undefined, role: 'cohost' } },
    { upsert: true },
  );

  const token = await createLiveKitToken({
    identity: req.user!.id,
    name: coHost?.displayName ?? 'Co-host',
    roomName: live.roomName,
    canPublish: true,
    canPublishData: true,
    metadata: { role: 'cohost' },
  });

  return ok(res, {
    token,
    roomName: live.roomName,
    livekitUrl: getLiveKitPublicUrl(),
    viewerCount: await countActiveViewers(live._id),
    role: 'cohost',
  });
});

/** POST /live/:id/colive/reject — invitee declines a pending co-live invite. */
export const coliveReject = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== LiveStatus.Live) throw ApiError.notFound('Stream is not live');

  const pending = live.pendingColiveInvite?.inviteeId?.toString();
  if (!pending || pending !== req.user!.id) {
    return ok(res, { rejected: true }, 'No pending invite');
  }

  await LiveStream.updateOne({ _id: live._id }, { $unset: { pendingColiveInvite: 1 } });

  emitToUser(live.host.toString(), SocketEvents.Notification, {
    title: 'Co-live declined',
    body: 'Your co-live invite was declined',
  });

  return ok(res, { rejected: true }, 'Co-live invite declined');
});

/** POST /live/:id/colive/leave — co-host leaves (or host removes co-host). */
export const coliveLeave = asyncHandler(async (req: Request, res: Response) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound('Stream not found');
  const uid = req.user!.id;
  const isHost = live.host.toString() === uid;
  const isCoHost = live.coHost?.toString() === uid;
  if (!isHost && !isCoHost) throw ApiError.forbidden('Not a co-live participant');

  const leavingId = isCoHost ? uid : live.coHost?.toString();
  if (!leavingId) return ok(res, { ok: true }, 'No co-host');

  live.coHost = undefined;
  await live.save();
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: leavingId },
    { $set: { leftAt: new Date() } },
  );
  try {
    await removeParticipant(live.roomName, leavingId);
  } catch {
    /* ignore */
  }

  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveColiveLeave, {
    liveId: live._id.toString(),
    userId: leavingId,
  });
  return ok(res, { ok: true }, 'Co-host left');
});
