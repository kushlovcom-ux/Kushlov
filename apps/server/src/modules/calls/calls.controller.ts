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
import { createLiveKitToken, removeParticipant, closeRoom, setParticipantMuted } from '../../services/livekit.service';
import { spendDiamonds, ensureWallet } from '../../services/wallet.service';
import { getSettings } from '../../services/settings.service';
import { emitToUser } from '../../socket/io';
import { assertUsersCanConnect } from '../../services/location.service';
import { getLiveKitPublicUrl } from '../../config/env';
import { getBusyUserIds } from '../../services/call-busy.service';
import { pruneStaleCalls } from '../../services/call-lifecycle.service';
import {
  notify,
  notifyCallCancelled,
  notifyIncomingCall,
  notifyMissedCall,
} from '../../services/notification.service';
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

/** Issue a LiveKit token with the user's display name so clients never show raw ids. */
async function liveKitTokenFor(
  userId: string,
  roomName: string,
  opts?: { name?: string },
): Promise<string> {
  const name =
    opts?.name ??
    (await User.findById(userId).select('displayName'))?.displayName ??
    undefined;
  return createLiveKitToken({
    identity: userId,
    name,
    roomName,
    canPublish: true,
  });
}

function participantIdsOf(call: ICall): string[] {
  const parts = (call.participants ?? []).map((p) => p.toString());
  if (parts.length > 0) return [...new Set(parts)];
  // Legacy rows before participants were always maintained on join/remove.
  return [...new Set([call.caller.toString(), call.callee.toString()])];
}

function isCallMember(call: ICall, userId: string): boolean {
  return participantIdsOf(call).includes(userId);
}

/** Mute everyone on an Ongoing call and tell remotes they are on hold. */
async function parkOngoingCall(
  call: ICall,
  heldBy: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await setParticipantMuted(call.roomName, heldBy, true);
  } catch {
    /* already left */
  }
  const payload = {
    callId: call._id.toString(),
    type: call.type,
    heldBy,
    held: true,
    ...extra,
  };
  for (const memberId of participantIdsOf(call)) {
    if (memberId === heldBy) continue;
    try {
      await setParticipantMuted(call.roomName, memberId, true);
    } catch {
      /* ignore */
    }
    emitToUser(memberId, SocketEvents.CallHold, payload);
  }
}

type MergeRosterMember = { id: string; displayName?: string; avatarUrl?: string };

/**
 * Fold a parked 1:1 into an Ongoing consult. Used by POST /merge and automatically
 * when the consult callee answers — otherwise the website just switched to the
 * second person and left the first one behind.
 */
async function mergeHeldIntoActive(
  active: ICall,
  uid: string,
  heldCallId: string,
  opts?: { skipNotifyUserId?: string },
): Promise<{ heldId: string; members: MergeRosterMember[] } | null> {
  const held =
    (await AudioCall.findById(heldCallId)) || (await VideoCall.findById(heldCallId));
  if (!held || held.status !== CallStatus.Ongoing) return null;
  if (!isCallMember(held, uid)) return null;

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
  const members: MergeRosterMember[] = [];
  const allRoster = await rosterOf(active);

  for (const memberId of heldMembers) {
    const joiner = await User.findById(memberId).select('displayName avatarUrl');
    const joinerToken = await liveKitTokenFor(memberId, active.roomName, {
      name: joiner?.displayName,
    });
    members.push({
      id: memberId,
      displayName: joiner?.displayName,
      avatarUrl: joiner?.avatarUrl,
    });
    const rosterForMember = allRoster.filter((p) => p.id !== memberId);
    const joinPayload = {
      callId: active._id.toString(),
      type: activeType,
      status: CallStatus.Ongoing,
      roomName: active.roomName,
      livekitUrl,
      maxDurationSec: active.maxDurationSec,
      mergedFromHold: held._id.toString(),
      merged: true,
      token: joinerToken,
      call: active,
      participants: rosterForMember,
      participant: {
        id: memberId,
        displayName: joiner?.displayName,
        avatarUrl: joiner?.avatarUrl,
      },
    };
    // CallAccept switches B into the conference room.
    emitToUser(memberId, SocketEvents.CallAccept, joinPayload);
    // CallUnhold must carry the same token/room — otherwise a client that
    // only handles unhold (or gets unhold first) rejoins the empty held room.
    emitToUser(memberId, SocketEvents.CallUnhold, {
      callId: active._id.toString(),
      heldCallId: held._id.toString(),
      type: activeType,
      held: false,
      merged: true,
      mergedFromHold: held._id.toString(),
      token: joinerToken,
      roomName: active.roomName,
      livekitUrl,
      maxDurationSec: active.maxDurationSec,
      status: CallStatus.Ongoing,
      participants: rosterForMember,
    });
    for (const mid of participantIdsOf(active)) {
      if (mid === memberId) continue;
      if (opts?.skipNotifyUserId && mid === opts.skipNotifyUserId) continue;
      emitToUser(mid, SocketEvents.CallParticipantJoined, {
        callId: active._id.toString(),
        type: activeType,
        roomName: active.roomName,
        livekitUrl,
        mergedFromHold: held._id.toString(),
        participant: {
          id: memberId,
          displayName: joiner?.displayName,
          avatarUrl: joiner?.avatarUrl,
        },
        participants: allRoster.filter((p) => p.id !== mid),
      });
    }
  }

  return { heldId: held._id.toString(), members };
}

async function rosterOf(call: ICall, exceptId?: string): Promise<MergeRosterMember[]> {
  const ids = participantIdsOf(call).filter((id) => id !== exceptId);
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids } }).select('displayName avatarUrl');
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return ids.map((id) => ({
    id,
    displayName: byId.get(id)?.displayName,
    avatarUrl: byId.get(id)?.avatarUrl,
  }));
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
    void notifyIncomingCall({
      userId: primaryCalleeId,
      callId: interrupt._id.toString(),
      callerId: req.user!.id,
      callerName: caller?.displayName ?? 'Someone',
      callerAvatar: caller?.avatarUrl,
      callType: type === CallType.Video ? 'video' : 'audio',
      interrupt: true,
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
    'displayName avatarUrl role isHostApproved isOnline videoPrice audioPrice',
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

  const caller = await User.findById(req.user!.id).select(
    'displayName avatarUrl role isHostApproved',
  );
  const token = await liveKitTokenFor(req.user!.id, roomName, {
    name: caller?.displayName,
  });
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
    void notifyIncomingCall({
      userId: id,
      callId: call._id.toString(),
      callerId: req.user!.id,
      callerName: caller?.displayName ?? 'Someone',
      callerAvatar: caller?.avatarUrl,
      callType: type === CallType.Video ? 'video' : 'audio',
    });
  }

  // Park other members of the held call while the consult rings.
  // Mute the holder instead of removing them: the holder's client leaves the
  // held room by itself when it switches to the consult token, and a forced
  // removal arrives first, which the client reads as the call dropping.
  if (heldCall && heldType) {
    try {
      await setParticipantMuted(heldCall.roomName, req.user!.id, true);
    } catch {
      /* already left */
    }
    const holdPayload = {
      callId: heldCall._id.toString(),
      type: heldType,
      heldBy: req.user!.id,
      held: true,
      consultCallId: call._id.toString(),
      consultType: type,
    };
    for (const memberId of participantIdsOf(heldCall)) {
      if (memberId === req.user!.id) continue;
      try {
        await setParticipantMuted(heldCall.roomName, memberId, true);
      } catch {
        /* ignore */
      }
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
      // So the caller UI can show B's name immediately (call.callee is only an id).
      callee: {
        id: callee._id.toString(),
        displayName: callee.displayName,
        avatarUrl: callee.avatarUrl,
        role: callee.role,
        isHostApproved: callee.isHostApproved,
      },
      caller: caller
        ? {
            id: caller._id.toString(),
            displayName: caller.displayName,
            avatarUrl: caller.avatarUrl,
            role: caller.role,
            isHostApproved: caller.isHostApproved,
          }
        : undefined,
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
    token = await liveKitTokenFor(uid, call.roomName);
    livekitUrl = getLiveKitPublicUrl() ?? undefined;
  } else if (
    call.status === CallStatus.Ringing &&
    isCallMember(call, uid) &&
    call.caller.toString() === uid
  ) {
    // Caller can join the room while ringing so media is ready on accept.
    token = await liveKitTokenFor(uid, call.roomName);
    livekitUrl = getLiveKitPublicUrl() ?? undefined;
  }

  const participants = await rosterOf(call, uid);

  return ok(res, {
    call,
    status: call.status,
    token,
    roomName: call.roomName,
    livekitUrl,
    maxDurationSec: call.maxDurationSec,
    participants,
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

  const joinerToken = await liveKitTokenFor(uid, call.roomName);
  const livekitUrl = getLiveKitPublicUrl();
  const allRoster = await rosterOf(call);

  // Notify caller (and other members) that someone joined / call accepted.
  const joiner = await User.findById(uid).select('displayName avatarUrl');
  for (const memberId of participantIdsOf(call)) {
    if (memberId === uid) continue;
    const payload =
      memberId === call.caller.toString() && isPrimaryCallee
        ? {
            callId: call._id.toString(),
            type,
            status: CallStatus.Ongoing,
            roomName: call.roomName,
            livekitUrl,
            maxDurationSec: call.maxDurationSec,
            token: await liveKitTokenFor(memberId, call.roomName),
            participants: allRoster.filter((p) => p.id !== memberId),
          }
        : {
            callId: call._id.toString(),
            type,
            status: CallStatus.Ongoing,
            roomName: call.roomName,
            livekitUrl,
            maxDurationSec: call.maxDurationSec,
            participant: {
              id: uid,
              displayName: joiner?.displayName,
              avatarUrl: joiner?.avatarUrl,
            },
            participants: allRoster.filter((p) => p.id !== memberId),
          };
    emitToUser(
      memberId,
      memberId === call.caller.toString() && isPrimaryCallee
        ? SocketEvents.CallAccept
        : SocketEvents.CallParticipantJoined,
      payload,
    );
  }

  // Stop the incoming-call UI on this user's other devices.
  void notifyCallCancelled({
    userId: uid,
    callId: call._id.toString(),
    callType: type === CallType.Video ? 'video' : 'audio',
  });

  return ok(
    res,
    {
      call,
      token: joinerToken,
      roomName: call.roomName,
      livekitUrl,
      maxDurationSec: call.maxDurationSec,
      participants: allRoster.filter((p) => p.id !== uid),
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
    void notifyCallCancelled({
      userId: uid,
      callId: call._id.toString(),
      callType: type === CallType.Video ? 'video' : 'audio',
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
  const rejectPayload = { callId: call._id.toString(), reason: 'rejected' };
  emitToUser(call.caller.toString(), SocketEvents.CallReject, rejectPayload);
  for (const memberId of participantIdsOf(call)) {
    if (memberId === uid) continue;
    emitToUser(memberId, SocketEvents.CallReject, rejectPayload);
  }
  void notifyCallCancelled({
    userId: uid,
    callId: call._id.toString(),
    callType: type === CallType.Video ? 'video' : 'audio',
  });
  return ok(res, call, 'Call rejected');
});

/**
 * POST /calls/:type/:id/accept-interrupt
 * Busy user A accepts C's call-waiting invite → park A↔B and talk to C.
 * A can later merge the held leg with C.
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
      throw ApiError.badRequest('Your current call ended — cannot answer');
    }
    target = fallback.call;
    targetType = fallback.type;
  }

  if (!isCallMember(target, uid)) throw ApiError.forbidden('Not on the ongoing call');

  const joinerId = interrupt.caller.toString();
  if (isCallMember(target, joinerId)) {
    interrupt.status = CallStatus.Ended;
    interrupt.endedAt = new Date();
    await interrupt.save();
    throw ApiError.badRequest('Caller is already on this call');
  }

  await parkOngoingCall(target, uid, {
    consultCallId: interrupt._id.toString(),
    consultType: type,
  });

  interrupt.status = CallStatus.Ongoing;
  interrupt.startedAt = new Date();
  interrupt.isInterrupt = false;
  interrupt.pendingInvites = [];
  interrupt.participants = [uid, joinerId] as unknown as typeof interrupt.participants;
  interrupt.targetCallId = target._id;
  await interrupt.save();

  const livekitUrl = getLiveKitPublicUrl();
  const joinerToken = await liveKitTokenFor(joinerId, interrupt.roomName);
  const acceptorToken = await liveKitTokenFor(uid, interrupt.roomName);
  const allRoster = await rosterOf(interrupt);

  emitToUser(joinerId, SocketEvents.CallAccept, {
    callId: interrupt._id.toString(),
    type,
    status: CallStatus.Ongoing,
    roomName: interrupt.roomName,
    livekitUrl,
    maxDurationSec: interrupt.maxDurationSec,
    token: joinerToken,
    call: interrupt,
    participants: allRoster.filter((p) => p.id !== joinerId),
    heldCallId: target._id.toString(),
  });

  void notifyCallCancelled({
    userId: uid,
    callId: interrupt._id.toString(),
    callType: type === CallType.Video ? 'video' : 'audio',
  });

  return ok(
    res,
    {
      call: interrupt,
      type,
      token: acceptorToken,
      roomName: interrupt.roomName,
      livekitUrl,
      maxDurationSec: interrupt.maxDurationSec,
      parked: true,
      heldCallId: target._id.toString(),
      heldType: targetType,
      participants: allRoster.filter((p) => p.id !== uid),
    },
    'Answered — previous call on hold',
  );
});

/** POST /calls/:type/:id/hold — park peers on an Ongoing call (consult). */
export const holdCall = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as CallType;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound('Call not found');
  if (call.status !== CallStatus.Ongoing) throw ApiError.badRequest('Call is not ongoing');
  if (!isCallMember(call, req.user!.id)) throw ApiError.forbidden('Not your call');

  // Mute the holder so held peers cannot hear them. Removing them from the room
  // instead makes their client see a disconnect and tear the call down.
  try {
    await setParticipantMuted(call.roomName, req.user!.id, true);
  } catch {
    /* already left */
  }

  const payload = {
    callId: call._id.toString(),
    type,
    heldBy: req.user!.id,
    held: true,
  };
  for (const memberId of participantIdsOf(call)) {
    if (memberId === req.user!.id) continue;
    try {
      await setParticipantMuted(call.roomName, memberId, true);
    } catch {
      /* ignore */
    }
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
  const token = await liveKitTokenFor(req.user!.id, call.roomName);

  // Hold muted us server-side; lift that before anyone rejoins.
  try {
    await setParticipantMuted(call.roomName, req.user!.id, false);
  } catch {
    /* not in the room yet */
  }

  // Unmute held peers and give them fresh tokens so they can republish.
  for (const memberId of participantIdsOf(call)) {
    if (memberId === req.user!.id) continue;
    try {
      await setParticipantMuted(call.roomName, memberId, false);
    } catch {
      /* ignore */
    }
    const peerToken = await liveKitTokenFor(memberId, call.roomName);
    emitToUser(memberId, SocketEvents.CallUnhold, {
      callId: call._id.toString(),
      type,
      heldBy: req.user!.id,
      held: false,
      token: peerToken,
      roomName: call.roomName,
      livekitUrl,
      maxDurationSec: call.maxDurationSec,
    });
  }

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

  const merged = await mergeHeldIntoActive(active, uid, heldCallId);
  if (!merged) throw ApiError.badRequest('Held call is not ongoing');

  const livekitUrl = getLiveKitPublicUrl();
  const activeType = active.type as CallType;
  const selfToken = await liveKitTokenFor(uid, active.roomName);
  const participants = await rosterOf(active, uid);

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
      participants,
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
    try {
      await closeRoom(call.roomName);
    } catch {
      /* ignore */
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
  void notifyIncomingCall({
    userId,
    callId: call._id.toString(),
    callerId: req.user!.id,
    callerName: from?.displayName ?? 'Someone',
    callerAvatar: from?.avatarUrl,
    callType: type === CallType.Video ? 'video' : 'audio',
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
  const uid = req.user!.id;
  const membersNow = participantIdsOf(call);
  const remaining = membersNow.filter((id) => id !== uid);

  // Conference: one person leaving must not drop everyone else.
  if (
    call.status === CallStatus.Ongoing &&
    !call.isInterrupt &&
    remaining.length >= 2
  ) {
    call.participants = remaining as unknown as typeof call.participants;
    call.pendingInvites = (call.pendingInvites ?? []).filter((p) => p.toString() !== uid);
    await call.save();
    try {
      await removeParticipant(call.roomName, uid);
    } catch {
      /* already gone */
    }
    for (const memberId of remaining) {
      emitToUser(memberId, SocketEvents.CallParticipantLeft, {
        callId: call._id.toString(),
        type,
        userId: uid,
      });
    }
    return ok(res, { call, left: true, ended: false }, 'Left call');
  }

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

  // Caller cancelled while still ringing → stop callee's incoming-call UI + push.
  const wasRingingOnly = !call.startedAt && call.status === CallStatus.Missed;
  if (wasRingingOnly) {
    const callerId = call.caller.toString();
    const calleeId = call.callee.toString();
    const endedByCaller = uid === callerId;
    if (endedByCaller) {
      for (const memberId of [...participantIdsOf(call), calleeId]) {
        if (memberId === uid) continue;
        void notifyCallCancelled({
          userId: memberId,
          callId: call._id.toString(),
          callType: type === CallType.Video ? 'video' : 'audio',
        });
      }
    } else {
      // Callee never answered → missed for callee (they already know); notify inbox.
      const callerUser = await User.findById(callerId).select('displayName');
      void notifyMissedCall({
        userId: calleeId,
        callId: call._id.toString(),
        callerId,
        callerName: callerUser?.displayName ?? 'Someone',
        callType: type === CallType.Video ? 'video' : 'audio',
      });
    }
  }

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
      cancelled: wasRingingOnly && uid === call.caller.toString(),
    });
  }

  // Force everyone out of LiveKit so nobody is left alone in the room.
  try {
    await closeRoom(call.roomName);
  } catch {
    /* ignore */
  }

  return ok(res, call, 'Call ended');
});

/**
 * GET /calls/active — Ongoing calls the user is on, with LiveKit tokens.
 * Used by parked clients after a peer merges them into a consult room when
 * `call:accept` / `call:unhold` sockets were missed.
 */
export const listActiveCalls = asyncHandler(async (req: Request, res: Response) => {
  const uid = req.user!.id;
  const filter = {
    status: CallStatus.Ongoing,
    $or: [{ participants: uid }, { caller: uid }, { callee: uid }],
  };
  const [audio, video] = await Promise.all([
    AudioCall.find(filter).sort({ updatedAt: -1 }).limit(5),
    VideoCall.find(filter).sort({ updatedAt: -1 }).limit(5),
  ]);

  const rows = [...audio, ...video].sort(
    (a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime(),
  );

  const items = [];
  for (const call of rows) {
    if (!isCallMember(call, uid)) continue;
    const type = call.type as CallType;
    const token = await liveKitTokenFor(uid, call.roomName);
    const participants = await rosterOf(call, uid);
    items.push({
      call,
      type,
      status: call.status,
      token,
      roomName: call.roomName,
      livekitUrl: getLiveKitPublicUrl(),
      maxDurationSec: call.maxDurationSec,
      participants,
    });
  }

  return ok(res, { items });
});

/** GET /calls/history — combined audio + video call history. */
export const callHistory = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { $or: [{ caller: req.user!.id }, { callee: req.user!.id }] };
  const populatePeer = { path: 'caller callee', select: 'displayName username avatarUrl role' };
  const [audio, video] = await Promise.all([
    AudioCall.find(filter).populate(populatePeer).lean(),
    VideoCall.find(filter).populate(populatePeer).lean(),
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
