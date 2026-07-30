import { Request, Response } from 'express';
import {
  CallStatus,
  CallType,
  DiamondTxnReason,
  GoldTxnReason,
  NotificationType,
  Role,
  SocketEvents,
} from '@kushlov/types';
import { buildPaginated, directRoomName, parsePagination } from '@kushlov/utils';
import { AudioCall, ICall, User, VideoCall } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { createLiveKitToken, removeParticipant, closeRoom } from '../../services/livekit.service';
import { spendDiamonds, ensureWallet } from '../../services/wallet.service';
import { getSettings } from '../../services/settings.service';
import { emitToUser } from '../../socket/io';
import { assertUsersCanConnect } from '../../services/location.service';
import { getLiveKitPublicUrl } from '../../config/env';
import { getBusyUserIds } from '../../services/call-busy.service';
import { pruneStaleCalls } from '../../services/call-lifecycle.service';
import { notify } from '../../services/notification.service';
import {
  computeCallDiamondCost,
  isApprovedHost,
  maxAffordableCallSeconds,
  peerKindForRoles,
  resolveCallRatePerMinute,
  resolveSecondsPerDiamond,
} from '../../services/pricing.service';

const modelFor = (type: CallType) => (type === CallType.Audio ? AudioCall : VideoCall);
const MAX_CALL_PARTICIPANTS = 6;

function participantIdsOf(call: ICall): string[] {
  const parts = (call.participants ?? []).map((p) => p.toString());
  if (parts.length > 0) return [...new Set(parts)];
  // Legacy rows before participants were always maintained on join/remove.
  return [...new Set([call.caller.toString(), call.callee.toString()])];
}

function isCallMember(call: ICall, userId: string): boolean {
  return participantIdsOf(call).includes(userId);
}

function isPendingInvitee(call: ICall, userId: string): boolean {
  return (call.pendingInvites ?? []).some((p) => p.toString() === userId);
}

/** Find an Ongoing call that this user is actually on (participants first). */
async function findOngoingCallForUser(
  userId: string,
  preferType?: CallType,
): Promise<{ call: ICall; type: CallType } | null> {
  const filter = {
    status: CallStatus.Ongoing,
    $or: [
      { participants: userId },
      // Legacy Ongoing rows with empty participants.
      {
        $and: [
          { $or: [{ participants: { $size: 0 } }, { participants: { $exists: false } }] },
          { $or: [{ caller: userId }, { callee: userId }] },
        ],
      },
    ],
  };
  if (preferType) {
    const preferred = await modelFor(preferType).findOne(filter);
    if (preferred) return { call: preferred, type: preferType };
  }
  const [audio, video] = await Promise.all([
    AudioCall.findOne(filter),
    VideoCall.findOne(filter),
  ]);
  if (audio) return { call: audio, type: CallType.Audio };
  if (video) return { call: video, type: CallType.Video };
  return null;
}


/**
 * POST /calls/initiate
 * - Normal users may call hosts or other users (diamonds required)
 * - Hosts may call other approved hosts or normal users (diamonds required)
 * - Optional participantIds[] for group start (1B); first id is primary callee
 * - Call auto-ends when caller's affordable duration (from diamonds) runs out
 */
export const initiateCall = asyncHandler(async (req: Request, res: Response) => {
  const { type, calleeId, participantIds, fromCallId } = req.body as {
    type: CallType;
    calleeId?: string;
    participantIds?: string[];
    fromCallId?: string;
  };

  const extras = (participantIds ?? []).map(String).filter((id) => id && id !== req.user!.id);
  const primaryCalleeId = String(calleeId || extras[0] || '');
  if (!primaryCalleeId) throw ApiError.badRequest('calleeId or participantIds required');
  if (primaryCalleeId === req.user!.id) throw ApiError.badRequest('You cannot call yourself');

  const groupIds = [...new Set([primaryCalleeId, ...extras])].slice(0, MAX_CALL_PARTICIPANTS - 1);
  if (groupIds.length + 1 > MAX_CALL_PARTICIPANTS) {
    throw ApiError.badRequest(`Max ${MAX_CALL_PARTICIPANTS} participants per call`);
  }

  const callerRole = req.user!.role;
  if (callerRole !== Role.User && callerRole !== Role.Host) {
    throw ApiError.forbidden('You cannot initiate calls');
  }

  for (const id of groupIds) {
    await assertUsersCanConnect(req.user!.id, id);
  }

  // Clear abandoned Ongoing/Ringing rows before busy checks (ghost "Busy" fix).
  await pruneStaleCalls();

  /** Consult: park an Ongoing call and ring another user. */
  let heldCall: ICall | null = null;
  let heldType: CallType | undefined;
  if (fromCallId) {
    heldCall =
      (await AudioCall.findById(fromCallId)) || (await VideoCall.findById(fromCallId));
    if (!heldCall || heldCall.status !== CallStatus.Ongoing) {
      throw ApiError.badRequest('Held call is not ongoing');
    }
    if (!isCallMember(heldCall, req.user!.id)) {
      throw ApiError.forbidden('Not a member of the held call');
    }
    if (groupIds.length > 1) {
      throw ApiError.badRequest('Consult call supports one callee at a time');
    }
    if (isCallMember(heldCall, primaryCalleeId)) {
      throw ApiError.badRequest('User is already on your current call');
    }
    heldType = heldCall.type as CallType;
  }

  const busy = await getBusyUserIds([req.user!.id, ...groupIds]);
  if (busy.has(req.user!.id) && !heldCall) {
    throw ApiError.badRequest('You are already on another call');
  }

  // Soft-busy / call-waiting: 1:1 only — callee is on another Ongoing call (not consult).
  const calleeBusy = busy.has(primaryCalleeId);
  if (heldCall && calleeBusy) {
    throw ApiError.badRequest('One of the invited users is busy on another call');
  }
  if (!heldCall && calleeBusy && groupIds.length === 1) {
    const ongoing = await findOngoingCallForUser(primaryCalleeId, type);
    if (!ongoing) {
      throw ApiError.badRequest('One of the invited users is busy on another call');
    }
    if (participantIdsOf(ongoing.call).length >= MAX_CALL_PARTICIPANTS) {
      throw ApiError.badRequest('That call is full');
    }

    const callee = await User.findById(primaryCalleeId).select(
      'displayName role isHostApproved isOnline videoPrice audioPrice',
    );
    if (!callee) throw ApiError.notFound('Callee not found');

    const peerKind = peerKindForRoles(callerRole, callee.role);
    if (!peerKind) throw ApiError.forbidden('You cannot call this account');
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
    const minNeeded = ratePerMinute > 0 ? ratePerMinute : secondsPerDiamond > 0 ? 1 : 0;
    if (wallet.diamonds <= 0 || wallet.diamonds < minNeeded || maxDurationSec < 1) {
      throw ApiError.badRequest(
        `Not enough diamonds to start this ${type} call. Need at least ${Math.max(1, minNeeded)} diamond(s).`,
      );
    }

    const Model = modelFor(type);
    const interrupt = await Model.create({
      type,
      caller: req.user!.id,
      callee: primaryCalleeId,
      participants: [req.user!.id],
      pendingInvites: [primaryCalleeId],
      roomName: `interrupt_${req.user!.id}_${primaryCalleeId}_${Date.now()}`,
      status: CallStatus.Ringing,
      isInterrupt: true,
      targetCallId: ongoing.call._id,
      ratePerMinute,
      secondsPerDiamond,
      maxDurationSec,
    });

    const caller = await User.findById(req.user!.id).select(
      'displayName avatarUrl role isHostApproved',
    );
    const waitingPayload = {
      callId: interrupt._id.toString(),
      type,
      interrupt: true,
      targetCallId: ongoing.call._id.toString(),
      targetType: ongoing.type,
      from: {
        id: caller?._id.toString(),
        displayName: caller?.displayName,
        avatarUrl: caller?.avatarUrl,
        role: caller?.role,
        isHostApproved: caller?.isHostApproved,
      },
      ratePerMinute,
      maxDurationSec,
    };
    emitToUser(primaryCalleeId, SocketEvents.CallWaiting, waitingPayload);
    emitToUser(primaryCalleeId, SocketEvents.CallInvite, waitingPayload);
    void notify({
      userId: primaryCalleeId,
      type: NotificationType.Call,
      title: type === CallType.Video ? 'Incoming video call' : 'Incoming audio call',
      body: `${caller?.displayName ?? 'Someone'} is calling (call waiting)`,
      actor: req.user!.id,
      data: {
        kind: 'incoming_call',
        interrupt: true,
        callId: interrupt._id.toString(),
        callType: type,
        targetCallId: ongoing.call._id.toString(),
      },
    });

    return created(
      res,
      {
        busy: true,
        interrupt: true,
        message: 'One of the invited users is busy on another call',
        call: interrupt,
        callId: interrupt._id.toString(),
        type,
        targetCallId: ongoing.call._id.toString(),
        ratePerMinute,
        secondsPerDiamond,
        maxDurationSec,
      },
      'User is busy — call waiting…',
    );
  }

  for (const id of groupIds) {
    if (busy.has(id)) {
      throw ApiError.badRequest('One of the invited users is busy on another call');
    }
  }

  const callee = await User.findById(primaryCalleeId).select(
    'displayName role isHostApproved isOnline videoPrice audioPrice',
  );
  if (!callee) throw ApiError.notFound('Callee not found');

  const peerKind = peerKindForRoles(callerRole, callee.role);
  if (!peerKind) {
    throw ApiError.forbidden('You cannot call this account');
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
  if (wallet.diamonds <= 0 || wallet.diamonds < minNeeded || maxDurationSec < 1) {
    throw ApiError.badRequest(
      `Not enough diamonds to start this ${type} call. Need at least ${Math.max(1, minNeeded)} diamond(s).`,
    );
  }

  const roomName = `${directRoomName(req.user!.id, primaryCalleeId)}_${type}_${Date.now()}`;
  const Model = modelFor(type);
  const call = await Model.create({
    type,
    caller: req.user!.id,
    callee: primaryCalleeId,
    participants: [req.user!.id],
    pendingInvites: groupIds,
    roomName,
    status: CallStatus.Ringing,
    ratePerMinute,
    secondsPerDiamond,
    maxDurationSec,
    // Link consult → held Ongoing (not an inbound interrupt).
    ...(heldCall ? { targetCallId: heldCall._id, isInterrupt: false } : {}),
  });

  const token = await createLiveKitToken({
    identity: req.user!.id,
    roomName,
    canPublish: true,
  });

  const caller = await User.findById(req.user!.id).select(
    'displayName avatarUrl role isHostApproved',
  );
  const invitePayload = {
    callId: call._id.toString(),
    type,
    roomName,
    conference: groupIds.length > 1,
    from: {
      id: caller?._id.toString(),
      displayName: caller?.displayName,
      avatarUrl: caller?.avatarUrl,
      role: caller?.role,
      isHostApproved: caller?.isHostApproved,
    },
    ratePerMinute,
    maxDurationSec,
  };
  for (const id of groupIds) {
    emitToUser(id, SocketEvents.CallInvite, invitePayload);
    void notify({
      userId: id,
      type: NotificationType.Call,
      title: type === CallType.Video ? 'Incoming video call' : 'Incoming audio call',
      body: `${caller?.displayName ?? 'Someone'} is calling you`,
      actor: req.user!.id,
      data: {
        kind: 'incoming_call',
        callId: call._id.toString(),
        callType: type,
      },
    });
  }

  // Park other members of the held call while consult rings.
  if (heldCall && heldType) {
    const holdPayload = {
      callId: heldCall._id.toString(),
      type: heldType,
      heldBy: req.user!.id,
      held: true,
      consultCallId: call._id.toString(),
    };
    for (const memberId of participantIdsOf(heldCall)) {
      if (memberId === req.user!.id) continue;
      emitToUser(memberId, SocketEvents.CallHold, holdPayload);
    }
  }

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
      consult: Boolean(heldCall),
      heldCallId: heldCall?._id.toString(),
      heldType,
    },
    heldCall ? 'Consult calling…' : 'Calling…',
  );
});

/** GET /calls/:type/:id — poll call status (HTTP fallback when sockets are off). */
export const getCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  const uid = req.user!.id;
  if (!isCallMember(call, uid) && !isPendingInvitee(call, uid)) {
    throw ApiError.forbidden('Not your call');
  }

  let token: string | undefined;
  let livekitUrl: string | undefined;
  if (call.status === CallStatus.Ongoing && isCallMember(call, uid)) {
    token = await createLiveKitToken({ identity: uid, roomName: call.roomName });
    livekitUrl = getLiveKitPublicUrl() ?? undefined;
  }

  return ok(res, {
    call,
    status: call.status,
    token,
    roomName: call.roomName,
    livekitUrl,
    maxDurationSec: call.maxDurationSec,
  });
});

/** POST /calls/:type/:id/accept — callee or pending invitee accepts and receives a token. */
export const acceptCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (call.isInterrupt) {
    throw ApiError.badRequest('Use accept-interrupt for call-waiting invites');
  }
  const uid = req.user!.id;
  const isPrimaryCallee = call.callee.toString() === uid;
  const isInvitee = isPendingInvitee(call, uid);
  if (!isPrimaryCallee && !isInvitee) throw ApiError.forbidden('Not your call');

  if (call.status !== CallStatus.Ringing && call.status !== CallStatus.Ongoing) {
    throw ApiError.badRequest('Call is no longer joinable');
  }

  // First acceptor starts a ringing call; later invitees join ongoing.
  if (call.status === CallStatus.Ringing) {
    const wallet = await ensureWallet(call.caller.toString());
    const maxDurationSec = maxAffordableCallSeconds({
      diamonds: wallet.diamonds,
      ratePerMinute: call.ratePerMinute,
      secondsPerDiamond: call.secondsPerDiamond || 60,
    });
    if (maxDurationSec < 1) {
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
  }

  call.pendingInvites = (call.pendingInvites ?? []).filter((p) => p.toString() !== uid);
  const parts = new Set(participantIdsOf(call));
  parts.add(uid);
  call.participants = [...parts] as unknown as typeof call.participants;
  await call.save();

  const joinerToken = await createLiveKitToken({
    identity: uid,
    roomName: call.roomName,
    canPublish: true,
  });
  const livekitUrl = getLiveKitPublicUrl();

  // Notify caller (and other members) that someone joined / call accepted.
  const joiner = await User.findById(uid).select('displayName avatarUrl');
  for (const memberId of participantIdsOf(call)) {
    if (memberId === uid) continue;
    const payload =
      memberId === call.caller.toString() && isPrimaryCallee
        ? {
            callId: call._id.toString(),
            type,
            roomName: call.roomName,
            livekitUrl,
            maxDurationSec: call.maxDurationSec,
            token: await createLiveKitToken({
              identity: memberId,
              roomName: call.roomName,
              canPublish: true,
            }),
          }
        : {
            callId: call._id.toString(),
            type,
            roomName: call.roomName,
            livekitUrl,
            maxDurationSec: call.maxDurationSec,
            participant: {
              id: uid,
              displayName: joiner?.displayName,
              avatarUrl: joiner?.avatarUrl,
            },
          };
    emitToUser(
      memberId,
      memberId === call.caller.toString() && isPrimaryCallee
        ? SocketEvents.CallAccept
        : SocketEvents.CallParticipantJoined,
      payload,
    );
  }

  return ok(
    res,
    {
      call,
      token: joinerToken,
      roomName: call.roomName,
      livekitUrl,
      maxDurationSec: call.maxDurationSec,
    },
    'Call accepted',
  );
});

/** POST /calls/:type/:id/reject — callee / invitee rejects (including call-waiting interrupt). */
export const rejectCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  const uid = req.user!.id;
  const isPrimary = call.callee.toString() === uid;
  const isInvitee = isPendingInvitee(call, uid);
  if (!isPrimary && !isInvitee) throw ApiError.forbidden('Not your call');

  // Interrupt / call-waiting: decline without ending the ongoing A–B call.
  if (call.isInterrupt && call.status === CallStatus.Ringing) {
    call.status = CallStatus.Rejected;
    call.endedAt = new Date();
    call.pendingInvites = [];
    await call.save();
    emitToUser(call.caller.toString(), SocketEvents.CallReject, {
      callId: call._id.toString(),
      interrupt: true,
      reason: 'busy_declined',
    });
    return ok(res, call, 'Call waiting declined');
  }

  // Secondary invitee declining: just remove from pending.
  if (!isPrimary || call.status === CallStatus.Ongoing) {
    call.pendingInvites = (call.pendingInvites ?? []).filter((p) => p.toString() !== uid);
    await call.save();
    emitToUser(call.caller.toString(), SocketEvents.CallReject, {
      callId: call._id.toString(),
      userId: uid,
    });
    return ok(res, call, 'Invite declined');
  }

  call.status = CallStatus.Rejected;
  call.endedAt = new Date();
  await call.save();
  emitToUser(call.caller.toString(), SocketEvents.CallReject, { callId: call._id.toString() });
  return ok(res, call, 'Call rejected');
});

/**
 * POST /calls/:type/:id/accept-interrupt
 * Busy user A accepts C's call-waiting invite → merge C into A's ongoing room.
 */
export const acceptInterrupt = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const interrupt = await modelFor(type).findById(req.params.id);
  if (!interrupt) throw ApiError.notFound('Call not found');
  if (!interrupt.isInterrupt) throw ApiError.badRequest('Not a call-waiting invite');
  if (interrupt.status !== CallStatus.Ringing) {
    throw ApiError.badRequest('Call waiting is no longer active');
  }
  const uid = req.user!.id;
  if (interrupt.callee.toString() !== uid && !isPendingInvitee(interrupt, uid)) {
    throw ApiError.forbidden('Not your call');
  }
  if (!interrupt.targetCallId) throw ApiError.badRequest('Missing target call');

  // Prefer same type as interrupt; fall back to any ongoing for this user.
  let target =
    (await modelFor(type).findById(interrupt.targetCallId)) ||
    (await AudioCall.findById(interrupt.targetCallId)) ||
    (await VideoCall.findById(interrupt.targetCallId));
  let targetType = type;
  if (target && target.type) targetType = target.type as CallType;

  if (!target || target.status !== CallStatus.Ongoing) {
    const fallback = await findOngoingCallForUser(uid);
    if (!fallback) {
      interrupt.status = CallStatus.Failed;
      interrupt.endedAt = new Date();
      await interrupt.save();
      throw ApiError.badRequest('Your current call ended — cannot merge');
    }
    target = fallback.call;
    targetType = fallback.type;
  }

  if (!isCallMember(target, uid)) throw ApiError.forbidden('Not on the ongoing call');
  if (participantIdsOf(target).length >= MAX_CALL_PARTICIPANTS) {
    throw ApiError.badRequest('Call is full');
  }

  const joinerId = interrupt.caller.toString();
  if (isCallMember(target, joinerId)) {
    interrupt.status = CallStatus.Ended;
    interrupt.endedAt = new Date();
    await interrupt.save();
    throw ApiError.badRequest('Caller is already on this call');
  }

  target.pendingInvites = (target.pendingInvites ?? []).filter((p) => p.toString() !== joinerId);
  const parts = new Set(participantIdsOf(target));
  parts.add(joinerId);
  target.participants = [...parts] as unknown as typeof target.participants;
  await target.save();

  interrupt.status = CallStatus.Ended;
  interrupt.endedAt = new Date();
  interrupt.pendingInvites = [];
  await interrupt.save();

  const livekitUrl = getLiveKitPublicUrl();
  const joinerToken = await createLiveKitToken({
    identity: joinerId,
    roomName: target.roomName,
    canPublish: true,
  });
  const acceptorToken = await createLiveKitToken({
    identity: uid,
    roomName: target.roomName,
    canPublish: true,
  });

  const joiner = await User.findById(joinerId).select('displayName avatarUrl');
  const joinPayload = {
    callId: target._id.toString(),
    type: targetType,
    roomName: target.roomName,
    livekitUrl,
    maxDurationSec: target.maxDurationSec,
    mergedFromInterrupt: interrupt._id.toString(),
    participant: {
      id: joinerId,
      displayName: joiner?.displayName,
      avatarUrl: joiner?.avatarUrl,
    },
  };

  emitToUser(joinerId, SocketEvents.CallAccept, {
    ...joinPayload,
    token: joinerToken,
    interrupt: true,
    call: target,
  });
  for (const memberId of participantIdsOf(target)) {
    if (memberId === joinerId) continue;
    emitToUser(memberId, SocketEvents.CallParticipantJoined, joinPayload);
  }

  return ok(
    res,
    {
      call: target,
      type: targetType,
      token: acceptorToken,
      roomName: target.roomName,
      livekitUrl,
      maxDurationSec: target.maxDurationSec,
      merged: true,
    },
    'Merged into call',
  );
});

/** POST /calls/:type/:id/hold — park peers on an Ongoing call (consult). */
export const holdCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (call.status !== CallStatus.Ongoing) throw ApiError.badRequest('Call is not ongoing');
  if (!isCallMember(call, req.user!.id)) throw ApiError.forbidden('Not your call');

  const payload = {
    callId: call._id.toString(),
    type,
    heldBy: req.user!.id,
    held: true,
  };
  for (const memberId of participantIdsOf(call)) {
    if (memberId === req.user!.id) continue;
    emitToUser(memberId, SocketEvents.CallHold, payload);
  }
  return ok(res, payload, 'Call on hold');
});

/** POST /calls/:type/:id/unhold — resume a parked call. */
export const unholdCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (call.status !== CallStatus.Ongoing) throw ApiError.badRequest('Call is not ongoing');
  if (!isCallMember(call, req.user!.id)) throw ApiError.forbidden('Not your call');

  const livekitUrl = getLiveKitPublicUrl();
  const token = await createLiveKitToken({
    identity: req.user!.id,
    roomName: call.roomName,
    canPublish: true,
  });

  const payload = {
    callId: call._id.toString(),
    type,
    heldBy: req.user!.id,
    held: false,
    token,
    roomName: call.roomName,
    livekitUrl,
    maxDurationSec: call.maxDurationSec,
  };
  for (const memberId of participantIdsOf(call)) {
    if (memberId === req.user!.id) continue;
    emitToUser(memberId, SocketEvents.CallUnhold, {
      callId: call._id.toString(),
      type,
      heldBy: req.user!.id,
      held: false,
    });
  }
  return ok(res, payload, 'Call resumed');
});

/**
 * POST /calls/:type/:id/merge
 * Merge a held Ongoing call into the active consult Ongoing call (:id).
 */
export const mergeCalls = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const { heldCallId } = req.body as { heldCallId: string };
  const uid = req.user!.id;

  const active = await modelFor(type).findById(req.params.id);
  if (!active) throw ApiError.notFound('Active call not found');
  if (active.status !== CallStatus.Ongoing) throw ApiError.badRequest('Active call is not ongoing');
  if (!isCallMember(active, uid)) throw ApiError.forbidden('Not on the active call');

  let held =
    (await AudioCall.findById(heldCallId)) || (await VideoCall.findById(heldCallId));
  if (!held || held.status !== CallStatus.Ongoing) {
    throw ApiError.badRequest('Held call is not ongoing');
  }
  if (!isCallMember(held, uid)) throw ApiError.forbidden('Not on the held call');

  const heldMembers = participantIdsOf(held).filter((id) => id !== uid);
  const activeMembers = participantIdsOf(active);
  if (activeMembers.length + heldMembers.length > MAX_CALL_PARTICIPANTS) {
    throw ApiError.badRequest(`Max ${MAX_CALL_PARTICIPANTS} participants per call`);
  }

  const parts = new Set(activeMembers);
  for (const id of heldMembers) parts.add(id);
  active.participants = [...parts] as unknown as typeof active.participants;
  await active.save();

  held.status = CallStatus.Ended;
  held.endedAt = new Date();
  held.pendingInvites = [];
  await held.save();

  const livekitUrl = getLiveKitPublicUrl();
  const activeType = active.type as CallType;

  for (const memberId of heldMembers) {
    const joinerToken = await createLiveKitToken({
      identity: memberId,
      roomName: active.roomName,
      canPublish: true,
    });
    const joiner = await User.findById(memberId).select('displayName avatarUrl');
    const joinPayload = {
      callId: active._id.toString(),
      type: activeType,
      roomName: active.roomName,
      livekitUrl,
      maxDurationSec: active.maxDurationSec,
      mergedFromHold: held._id.toString(),
      participant: {
        id: memberId,
        displayName: joiner?.displayName,
        avatarUrl: joiner?.avatarUrl,
      },
    };
    emitToUser(memberId, SocketEvents.CallAccept, {
      ...joinPayload,
      token: joinerToken,
      merged: true,
      call: active,
    });
    emitToUser(memberId, SocketEvents.CallUnhold, {
      callId: held._id.toString(),
      type: held.type,
      held: false,
      merged: true,
    });
    for (const mid of participantIdsOf(active)) {
      if (mid === memberId) continue;
      emitToUser(mid, SocketEvents.CallParticipantJoined, joinPayload);
    }
  }

  // Close held LiveKit room after members have been directed to the active room.
  try {
    await closeRoom(held.roomName);
  } catch {
    /* ignore */
  }

  const selfToken = await createLiveKitToken({
    identity: uid,
    roomName: active.roomName,
    canPublish: true,
  });

  return ok(
    res,
    {
      call: active,
      type: activeType,
      token: selfToken,
      roomName: active.roomName,
      livekitUrl,
      maxDurationSec: active.maxDurationSec,
      merged: true,
    },
    'Calls merged',
  );
});

/**
 * POST /calls/:type/:id/participants/:userId/remove
 * Remove one participant without ending the whole call (unless fewer than 2 remain).
 */
export const removeCallParticipant = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const targetUserId = req.params.userId;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (call.status !== CallStatus.Ongoing) throw ApiError.badRequest('Call is not ongoing');
  if (!isCallMember(call, req.user!.id)) throw ApiError.forbidden('Not your call');
  if (targetUserId === req.user!.id) {
    throw ApiError.badRequest('Use end call to leave yourself');
  }
  if (!isCallMember(call, targetUserId)) {
    throw ApiError.badRequest('User is not on this call');
  }

  // Prefer caller authority; also allow any member to remove peers (UI gates).
  const members = participantIdsOf(call).filter((id) => id !== targetUserId);
  call.participants = members as unknown as typeof call.participants;
  call.pendingInvites = (call.pendingInvites ?? []).filter((p) => p.toString() !== targetUserId);
  await call.save();

  try {
    await removeParticipant(call.roomName, targetUserId);
  } catch {
    // room may already be gone
  }

  emitToUser(targetUserId, SocketEvents.CallParticipantLeft, {
    callId: call._id.toString(),
    type,
    userId: targetUserId,
    removedBy: req.user!.id,
    endedForYou: true,
  });
  for (const memberId of members) {
    emitToUser(memberId, SocketEvents.CallParticipantLeft, {
      callId: call._id.toString(),
      type,
      userId: targetUserId,
      removedBy: req.user!.id,
    });
  }

  if (members.length < 2) {
    // Tear down remaining 1:1 remnant.
    req.params.id = call._id.toString();
    // Inline minimal end for leftover participant
    call.status = CallStatus.Ended;
    call.endedAt = new Date();
    call.pendingInvites = [];
    await call.save();
    for (const memberId of members) {
      emitToUser(memberId, SocketEvents.CallEnd, {
        callId: call._id.toString(),
        reason: 'last_peer_removed',
      });
    }
    return ok(res, { call, ended: true }, 'Participant removed; call ended');
  }

  return ok(res, { call, ended: false }, 'Participant removed');
});

/** POST /calls/:type/:id/invite — add a user to an ongoing conference (1A). */
export const inviteToCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const { userId } = req.body as { userId: string };
  if (!userId) throw ApiError.badRequest('userId required');

  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (call.status !== CallStatus.Ongoing) throw ApiError.badRequest('Call is not ongoing');
  if (!isCallMember(call, req.user!.id)) throw ApiError.forbidden('Not your call');

  if (userId === req.user!.id) throw ApiError.badRequest('Cannot invite yourself');
  if (isCallMember(call, userId) || isPendingInvitee(call, userId)) {
    throw ApiError.badRequest('User already on this call');
  }
  if (participantIdsOf(call).length + (call.pendingInvites?.length ?? 0) >= MAX_CALL_PARTICIPANTS) {
    throw ApiError.badRequest(`Max ${MAX_CALL_PARTICIPANTS} participants`);
  }

  await assertUsersCanConnect(req.user!.id, userId);
  const busy = await getBusyUserIds([userId]);
  if (busy.has(userId)) throw ApiError.badRequest('User is busy on another call');

  const invitee = await User.findById(userId).select('displayName role isHostApproved');
  if (!invitee) throw ApiError.notFound('User not found');

  call.pendingInvites = [...(call.pendingInvites ?? []), invitee._id];
  await call.save();

  const from = await User.findById(req.user!.id).select(
    'displayName avatarUrl role isHostApproved',
  );
  emitToUser(userId, SocketEvents.CallInvite, {
    callId: call._id.toString(),
    type,
    roomName: call.roomName,
    conference: true,
    from: {
      id: from?._id.toString(),
      displayName: from?.displayName,
      avatarUrl: from?.avatarUrl,
      role: from?.role,
      isHostApproved: from?.isHostApproved,
    },
    maxDurationSec: call.maxDurationSec,
  });
  void notify({
    userId,
    type: NotificationType.Call,
    title: type === CallType.Video ? 'Incoming video call' : 'Incoming audio call',
    body: `${from?.displayName ?? 'Someone'} invited you to a call`,
    actor: req.user!.id,
    data: {
      kind: 'incoming_call',
      callId: call._id.toString(),
      callType: type,
    },
  });

  return ok(res, { call }, 'Invite sent');
});

/** POST /calls/:type/:id/end — end the call, compute billing, settle balances. */
export const endCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (!isCallMember(call, req.user!.id)) throw ApiError.forbidden('Not your call');

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
  call.pendingInvites = [];

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

  // Call-waiting interrupt: only notify the waiting caller. Never emit CallEnd
  // to the busy callee — they are still on their Ongoing A↔B call.
  if (call.isInterrupt) {
    const callerId = call.caller.toString();
    if (callerId !== req.user!.id) {
      emitToUser(callerId, SocketEvents.CallEnd, {
        callId: call._id.toString(),
        interrupt: true,
        durationSec,
      });
    }
    return ok(res, call, 'Call waiting ended');
  }

  for (const memberId of participantIdsOf(call)) {
    if (memberId === req.user!.id) continue;
    emitToUser(memberId, SocketEvents.CallEnd, {
      callId: call._id.toString(),
      durationSec,
    });
  }
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

/** GET /calls/incoming — ringing invites for this user (HTTP fallback when sockets are off). */
export const listIncomingCalls = asyncHandler(async (req: Request, res: Response) => {
  const since = new Date(Date.now() - 90_000);
  const filter = {
    $or: [{ callee: req.user!.id }, { pendingInvites: req.user!.id }],
    status: { $in: [CallStatus.Ringing, CallStatus.Ongoing] },
    createdAt: { $gte: since },
  };

  const [audio, video] = await Promise.all([
    AudioCall.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('caller', 'displayName avatarUrl role isHostApproved'),
    VideoCall.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('caller', 'displayName avatarUrl role isHostApproved'),
  ]);

  const items = [...audio, ...video]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((call) => {
      // Only show if still pending for this user, or primary ringing callee
      const uid = req.user!.id;
      if (call.status === CallStatus.Ringing && call.callee.toString() === uid) return true;
      return (call.pendingInvites ?? []).some((p) => p.toString() === uid);
    })
    .map((call) => {
      const caller = call.caller as any;
      return {
        callId: call._id.toString(),
        type: call.type,
        roomName: call.roomName,
        maxDurationSec: call.maxDurationSec,
        conference: (call.participants?.length ?? 0) > 1 || (call.pendingInvites?.length ?? 0) > 1,
        interrupt: Boolean(call.isInterrupt),
        targetCallId: call.targetCallId?.toString?.(),
        from: {
          id: caller?._id?.toString?.() ?? caller?.id,
          displayName: caller?.displayName,
          avatarUrl: caller?.avatarUrl,
          role: caller?.role,
          isHostApproved: caller?.isHostApproved,
        },
      };
    });

  return ok(res, { items });
});
