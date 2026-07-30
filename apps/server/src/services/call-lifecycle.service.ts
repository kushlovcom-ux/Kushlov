import { CallStatus, SocketEvents } from '@kushlov/types';
import { AudioCall, VideoCall, User } from '../models';
import type { ICall } from '../models/call.model';
import { closeRoom, listRoomIdentities } from './livekit.service';
import { emitToUser } from '../socket/io';
import { PRESENCE_ONLINE_MS } from './presence.service';

/** Allow LiveKit connect after accept before treating the room as abandoned. */
const CALL_CONNECT_GRACE_MS = 90_000;
/** Unanswered ringing calls should not linger forever. */
const RINGING_TIMEOUT_MS = 120_000;
/** Hard ceiling for ghost Ongoing rows (regardless of LiveKit). */
const ONGOING_HARD_MAX_MS = 2 * 60 * 60_000;

function memberIds(call: ICall): string[] {
  const parts = (call.participants ?? []).map((p) => p.toString());
  if (parts.length > 0) return [...new Set(parts)];
  // Legacy rows before participants were always maintained.
  return [...new Set([call.caller.toString(), call.callee.toString()])];
}

async function forceCloseCall(
  call: ICall,
  reason: 'empty_room' | 'ring_timeout' | 'max_duration' | 'stale' | 'offline',
): Promise<void> {
  if (
    call.status !== CallStatus.Ongoing &&
    call.status !== CallStatus.Ringing
  ) {
    return;
  }

  const endedAt = new Date();
  const durationSec = call.startedAt
    ? Math.max(0, Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000))
    : 0;

  // Pruned / abandoned calls: no diamond billing — mark ended/missed only.
  call.endedAt = endedAt;
  call.durationSec = durationSec;
  call.status = call.startedAt ? CallStatus.Ended : CallStatus.Missed;
  call.pendingInvites = [];
  await call.save();

  try {
    await closeRoom(call.roomName);
  } catch {
    /* ignore */
  }

  const payload = {
    callId: call._id.toString(),
    durationSec,
    pruned: true,
    reason,
  };
  for (const memberId of memberIds(call)) {
    emitToUser(memberId, SocketEvents.CallEnd, payload);
  }
}

async function pruneOneOngoing(call: ICall): Promise<void> {
  const startedAt = call.startedAt?.getTime() ?? call.createdAt?.getTime() ?? 0;
  const ageMs = startedAt ? Date.now() - startedAt : Number.POSITIVE_INFINITY;

  if (ageMs >= ONGOING_HARD_MAX_MS) {
    await forceCloseCall(call, 'stale');
    return;
  }

  if (call.maxDurationSec > 0 && call.startedAt) {
    const overBy = Date.now() - (call.startedAt.getTime() + call.maxDurationSec * 1000);
    if (overBy > 60_000) {
      await forceCloseCall(call, 'max_duration');
      return;
    }
  }

  if (ageMs < CALL_CONNECT_GRACE_MS) return;

  const identities = await listRoomIdentities(call.roomName);
  if (identities !== null) {
    if (identities.length === 0) {
      await forceCloseCall(call, 'empty_room');
    }
    return;
  }

  // LiveKit unavailable: end if no member looks online.
  const ids = memberIds(call);
  if (ids.length === 0) {
    await forceCloseCall(call, 'offline');
    return;
  }
  const users = await User.find({ _id: { $in: ids } }).select('isOnline lastSeenAt');
  const cutoff = Date.now() - PRESENCE_ONLINE_MS;
  const anyoneOnline = users.some((u) => {
    if (u.lastSeenAt && new Date(u.lastSeenAt).getTime() >= cutoff) return true;
    return !!u.isOnline;
  });
  if (!anyoneOnline) await forceCloseCall(call, 'offline');
}

/**
 * Clear ghost Ongoing / abandoned Ringing calls so Discover Busy and
 * "You are already on another call" stop sticking after crashed clients.
 */
export async function pruneStaleCalls(): Promise<void> {
  const [ongoingAudio, ongoingVideo, ringingAudio, ringingVideo] = await Promise.all([
    AudioCall.find({ status: CallStatus.Ongoing }).select(
      'caller callee participants roomName status startedAt createdAt maxDurationSec pendingInvites',
    ),
    VideoCall.find({ status: CallStatus.Ongoing }).select(
      'caller callee participants roomName status startedAt createdAt maxDurationSec pendingInvites',
    ),
    AudioCall.find({ status: CallStatus.Ringing }).select(
      'caller callee participants roomName status startedAt createdAt maxDurationSec pendingInvites isInterrupt',
    ),
    VideoCall.find({ status: CallStatus.Ringing }).select(
      'caller callee participants roomName status startedAt createdAt maxDurationSec pendingInvites isInterrupt',
    ),
  ]);

  await Promise.all(
    [...ongoingAudio, ...ongoingVideo].map((call) =>
      pruneOneOngoing(call).catch(() => undefined),
    ),
  );

  const ringCutoff = Date.now() - RINGING_TIMEOUT_MS;
  await Promise.all(
    [...ringingAudio, ...ringingVideo].map(async (call) => {
      const created = call.createdAt?.getTime() ?? 0;
      if (created && created < ringCutoff) {
        await forceCloseCall(call, 'ring_timeout');
      }
    }),
  );
}

/** Best-effort cleanup when a user's last socket disconnects. */
export async function pruneCallsForUser(userId: string): Promise<void> {
  const filter = {
    status: { $in: [CallStatus.Ongoing, CallStatus.Ringing] },
    $or: [{ caller: userId }, { callee: userId }, { participants: userId }],
  };
  const [audio, video] = await Promise.all([
    AudioCall.find(filter),
    VideoCall.find(filter),
  ]);

  for (const call of [...audio, ...video]) {
    if (call.status === CallStatus.Ringing) {
      const created = call.createdAt?.getTime() ?? 0;
      if (created && Date.now() - created > RINGING_TIMEOUT_MS) {
        await forceCloseCall(call, 'ring_timeout');
      }
      continue;
    }

    const identities = await listRoomIdentities(call.roomName);
    if (identities !== null && identities.length === 0) {
      await forceCloseCall(call, 'empty_room');
      continue;
    }
    if (identities !== null && !identities.includes(userId)) {
      // User left LiveKit; if fewer than 2 remain, end the call.
      if (identities.length < 2) {
        await forceCloseCall(call, 'empty_room');
      }
    }
  }
}
