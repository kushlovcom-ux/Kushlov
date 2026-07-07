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

const modelFor = (type: CallType) => (type === CallType.Audio ? AudioCall : VideoCall);

/** POST /calls/initiate — a user starts an audio/video call to an approved host. */
export const initiateCall = asyncHandler(async (req: Request, res: Response) => {
  const { type, calleeId } = req.body as { type: CallType; calleeId: string };
  if (calleeId === req.user!.id) throw ApiError.badRequest('You cannot call yourself');

  await assertUsersCanConnect(req.user!.id, calleeId);

  const callee = await User.findById(calleeId).select('displayName role isHostApproved');
  if (!callee) throw ApiError.notFound('Callee not found');
  if (callee.role === Role.Host && !callee.isHostApproved) {
    throw ApiError.forbidden('Host is not approved to receive calls');
  }

  const settings = await getSettings();
  if (!settings.features.callsEnabled) throw ApiError.forbidden('Calls are currently disabled');
  const ratePerMinute =
    type === CallType.Audio ? settings.rates.audioCallPerMinute : settings.rates.videoCallPerMinute;

  if (req.user!.role === Role.Host) {
    throw ApiError.forbidden('Hosts cannot initiate paid calls. Users call you instead.');
  }
  if (callee.role === Role.Host) {
    const wallet = await ensureWallet(req.user!.id);
    if (wallet.diamonds < ratePerMinute) {
      throw ApiError.badRequest(
        `You need at least ${ratePerMinute} diamonds to call a host (${type} call rate per minute).`,
      );
    }
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
    from: caller,
  });

  return created(res, { call, token, roomName, livekitUrl: getLiveKitPublicUrl() }, 'Calling…');
});

/** POST /calls/:type/:id/accept — callee accepts and receives a token. */
export const acceptCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (call.callee.toString() !== req.user!.id) throw ApiError.forbidden('Not your call');

  call.status = CallStatus.Ongoing;
  call.startedAt = new Date();
  await call.save();

  const token = await createLiveKitToken({ identity: req.user!.id, roomName: call.roomName });
  emitToUser(call.caller.toString(), SocketEvents.CallAccept, { callId: call._id.toString() });
  return ok(res, { call, token, roomName: call.roomName, livekitUrl: getLiveKitPublicUrl() }, 'Call accepted');
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

  if (call.status === CallStatus.Ended) return ok(res, call, 'Already ended');

  const endedAt = new Date();
  const durationSec = call.startedAt
    ? Math.max(0, Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000))
    : 0;

  call.endedAt = endedAt;
  call.durationSec = durationSec;
  call.status = call.startedAt ? CallStatus.Ended : CallStatus.Missed;

  // Bill the caller per started minute; host earns gold via conversion.
  if (call.status === CallStatus.Ended && durationSec > 0) {
    const minutes = Math.ceil(durationSec / 60);
    const cost = minutes * call.ratePerMinute;
    try {
      const result = await spendDiamonds({
        userId: call.caller,
        hostId: call.callee,
        amount: cost,
        diamondReason:
          type === CallType.Audio ? DiamondTxnReason.AudioCall : DiamondTxnReason.VideoCall,
        goldReason: type === CallType.Audio ? GoldTxnReason.AudioCall : GoldTxnReason.VideoCall,
        reference: call._id,
        referenceModel: type === CallType.Audio ? 'AudioCall' : 'VideoCall',
        meta: { minutes },
      });
      call.diamondsSpent = cost;
      call.goldEarned = result.goldEarned;
    } catch {
      call.status = CallStatus.Failed; // insufficient balance during call
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
