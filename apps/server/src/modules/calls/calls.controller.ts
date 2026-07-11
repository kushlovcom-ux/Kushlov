import { Request, Response } from 'express';
import {
  CallStatus,
  CallType,
  DiamondTxnReason,
  GoldTxnReason,
  Role,
  SocketEvents,
} from '@kushlov/types';
import { buildPaginated, directRoomName, parsePagination } from '@kushlov/utils';
import { AudioCall, ICall, User, VideoCall } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { createLiveKitToken } from '../../services/livekit.service';
import { spendDiamonds, ensureWallet } from '../../services/wallet.service';
import { getSettings } from '../../services/settings.service';
import { emitToUser } from '../../socket/io';
import { assertUsersCanConnect } from '../../services/location.service';
import { getLiveKitPublicUrl } from '../../config/env';
import {
  computeCallDiamondCost,
  isApprovedHost,
  maxAffordableCallSeconds,
  peerKindForRoles,
  resolveCallRatePerMinute,
  resolveSecondsPerDiamond,
} from '../../services/pricing.service';

const modelFor = (type: CallType) => (type === CallType.Audio ? AudioCall : VideoCall);

/**
 * POST /calls/initiate
 * - Normal users may call hosts or other users
 * - Hosts may call other approved hosts only (not normal users)
 */
export const initiateCall = asyncHandler(async (req: Request, res: Response) => {
  const { type, calleeId } = req.body as { type: CallType; calleeId: string };
  if (calleeId === req.user!.id) throw ApiError.badRequest('You cannot call yourself');

  const callerRole = req.user!.role;
  if (callerRole !== Role.User && callerRole !== Role.Host) {
    throw ApiError.forbidden('You cannot initiate calls');
  }

  await assertUsersCanConnect(req.user!.id, calleeId);

  const callee = await User.findById(calleeId).select(
    'displayName role isHostApproved isOnline videoPrice audioPrice',
  );
  if (!callee) throw ApiError.notFound('Callee not found');

  const peerKind = peerKindForRoles(callerRole, callee.role);
  if (!peerKind) {
    throw ApiError.forbidden(
      callerRole === Role.Host
        ? 'Hosts can only call other hosts'
        : 'You cannot call this account',
    );
  }
  if ((peerKind === 'host' || peerKind === 'hostHost') && !isApprovedHost(callee)) {
    throw ApiError.forbidden('You can only call approved hosts');
  }

  const settings = await getSettings();
  if (!settings.features.callsEnabled) throw ApiError.forbidden('Calls are currently disabled');

  const ratePerMinute = resolveCallRatePerMinute(settings, callee, type, peerKind);
  const secondsPerDiamond = resolveSecondsPerDiamond(settings, type, peerKind);

  const wallet = await ensureWallet(req.user!.id);
  const maxDurationSec = maxAffordableCallSeconds({
    diamonds: wallet.diamonds,
    ratePerMinute,
    secondsPerDiamond,
  });

  const minNeeded =
    ratePerMinute > 0 ? ratePerMinute : secondsPerDiamond > 0 ? 1 : 0;
  if (wallet.diamonds < minNeeded || maxDurationSec < 30) {
    throw ApiError.badRequest(
      `Not enough diamonds to start this ${type} call. Need at least ${minNeeded} diamond(s).`,
    );
  }

  const roomName = `${directRoomName(req.user!.id, calleeId)}_${type}_${Date.now()}`;
  const Model = modelFor(type);
  const call = await Model.create({
    type,
    caller: req.user!.id,
    callee: calleeId,
    roomName,
    status: CallStatus.Ringing,
    ratePerMinute,
    secondsPerDiamond,
    maxDurationSec,
  });

  const token = await createLiveKitToken({
    identity: req.user!.id,
    roomName,
    canPublish: true,
  });

  const caller = await User.findById(req.user!.id).select('displayName avatarUrl');
  emitToUser(calleeId, SocketEvents.CallInvite, {
    callId: call._id.toString(),
    type,
    roomName,
    from: {
      id: caller?._id.toString(),
      displayName: caller?.displayName,
      avatarUrl: caller?.avatarUrl,
    },
    ratePerMinute,
    maxDurationSec,
  });

  return created(
    res,
    {
      call,
      token,
      roomName,
      livekitUrl: getLiveKitPublicUrl(),
      ratePerMinute,
      secondsPerDiamond,
      maxDurationSec,
    },
    'Calling…',
  );
});

/** POST /calls/:type/:id/accept — callee (host) accepts and receives a token. */
export const acceptCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (call.callee.toString() !== req.user!.id) throw ApiError.forbidden('Not your call');
  if (call.status !== CallStatus.Ringing) {
    throw ApiError.badRequest('Call is no longer ringing');
  }

  // Refresh max duration from caller's current balance at accept time.
  const wallet = await ensureWallet(call.caller.toString());
  const maxDurationSec = maxAffordableCallSeconds({
    diamonds: wallet.diamonds,
    ratePerMinute: call.ratePerMinute,
    secondsPerDiamond: call.secondsPerDiamond || 60,
  });
  if (maxDurationSec < 30) {
    call.status = CallStatus.Failed;
    call.endedAt = new Date();
    await call.save();
    emitToUser(call.caller.toString(), SocketEvents.CallReject, {
      callId: call._id.toString(),
      reason: 'insufficient_diamonds',
    });
    throw ApiError.badRequest('Caller no longer has enough diamonds for this call');
  }

  call.status = CallStatus.Ongoing;
  call.startedAt = new Date();
  call.maxDurationSec = maxDurationSec;
  await call.save();

  const [calleeToken, callerToken] = await Promise.all([
    createLiveKitToken({ identity: req.user!.id, roomName: call.roomName }),
    createLiveKitToken({ identity: call.caller.toString(), roomName: call.roomName }),
  ]);
  const livekitUrl = getLiveKitPublicUrl();
  emitToUser(call.caller.toString(), SocketEvents.CallAccept, {
    callId: call._id.toString(),
    type,
    roomName: call.roomName,
    livekitUrl,
    maxDurationSec,
    token: callerToken,
  });
  return ok(
    res,
    {
      call,
      token: calleeToken,
      roomName: call.roomName,
      livekitUrl,
      maxDurationSec,
    },
    'Call accepted',
  );
});

/** POST /calls/:type/:id/reject — callee rejects. */
export const rejectCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (call.callee.toString() !== req.user!.id) throw ApiError.forbidden('Not your call');

  call.status = CallStatus.Rejected;
  call.endedAt = new Date();
  await call.save();
  emitToUser(call.caller.toString(), SocketEvents.CallReject, { callId: call._id.toString() });
  return ok(res, call, 'Call rejected');
});

/** POST /calls/:type/:id/end — end the call, compute billing, settle balances. */
export const endCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  const isParticipant = [call.caller.toString(), call.callee.toString()].includes(req.user!.id);
  if (!isParticipant) throw ApiError.forbidden('Not your call');

  if (call.status === CallStatus.Ended || call.status === CallStatus.Failed) {
    return ok(res, call, 'Already ended');
  }

  const endedAt = new Date();
  let durationSec = call.startedAt
    ? Math.max(0, Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000))
    : 0;

  // Cap billed duration to what was affordable.
  if (call.maxDurationSec > 0 && durationSec > call.maxDurationSec) {
    durationSec = call.maxDurationSec;
  }

  call.endedAt = endedAt;
  call.durationSec = durationSec;
  call.status = call.startedAt ? CallStatus.Ended : CallStatus.Missed;

  if (call.status === CallStatus.Ended && durationSec > 0) {
    const cost = computeCallDiamondCost({
      durationSec,
      ratePerMinute: call.ratePerMinute,
      secondsPerDiamond: call.secondsPerDiamond || 60,
    });
    if (cost > 0) {
      try {
        const calleeUser = await User.findById(call.callee).select('role');
        const creditHost = calleeUser?.role === Role.Host ? call.callee : undefined;
        const result = await spendDiamonds({
          userId: call.caller,
          hostId: creditHost,
          amount: cost,
          diamondReason:
            type === CallType.Audio ? DiamondTxnReason.AudioCall : DiamondTxnReason.VideoCall,
          goldReason: creditHost
            ? type === CallType.Audio
              ? GoldTxnReason.AudioCall
              : GoldTxnReason.VideoCall
            : undefined,
          reference: call._id,
          referenceModel: type === CallType.Audio ? 'AudioCall' : 'VideoCall',
          meta: { durationSec, ratePerMinute: call.ratePerMinute },
        });
        call.diamondsSpent = cost;
        call.goldEarned = result.goldEarned;
      } catch {
        call.status = CallStatus.Failed;
      }
    }
  }

  await call.save();
  const other = call.caller.toString() === req.user!.id ? call.callee : call.caller;
  emitToUser(other.toString(), SocketEvents.CallEnd, {
    callId: call._id.toString(),
    durationSec,
  });
  return ok(res, call, 'Call ended');
});

/** GET /calls/history — combined audio + video call history. */
export const callHistory = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { $or: [{ caller: req.user!.id }, { callee: req.user!.id }] };
  const [audio, video] = await Promise.all([
    AudioCall.find(filter).lean(),
    VideoCall.find(filter).lean(),
  ]);
  const all = [...audio, ...video].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const total = all.length;
  const items = all.slice(skip, skip + limit);
  return ok(res, buildPaginated(items as unknown as ICall[], page, limit, total));
});
