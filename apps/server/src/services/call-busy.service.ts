import { Types } from 'mongoose';
import { CallStatus } from '@kushlov/types';
import { AudioCall, VideoCall } from '../models';
import { pruneStaleCalls } from './call-lifecycle.service';

let lastPruneAt = 0;
const PRUNE_THROTTLE_MS = 15_000;

/** Opportunistically clear ghost Ongoing rows (throttled). */
export async function maybePruneStaleCalls(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_THROTTLE_MS) return;
  lastPruneAt = now;
  try {
    await pruneStaleCalls();
  } catch {
    /* ignore */
  }
}

/**
 * Users currently on an ongoing audio/video call.
 * Membership prefers `participants` (source of truth after join/remove).
 * Falls back to caller+callee only for legacy rows with an empty participants list.
 */
export async function getBusyUserIds(
  userIds: (string | Types.ObjectId)[],
): Promise<Set<string>> {
  if (!userIds.length) return new Set();

  await maybePruneStaleCalls();

  const ids = userIds.map((id) => new Types.ObjectId(String(id)));
  const filter = {
    status: CallStatus.Ongoing,
    $or: [
      { participants: { $in: ids } },
      { caller: { $in: ids } },
      { callee: { $in: ids } },
    ],
  };

  const [audio, video] = await Promise.all([
    AudioCall.find(filter).select('caller callee participants').lean(),
    VideoCall.find(filter).select('caller callee participants').lean(),
  ]);

  const busy = new Set<string>();
  const wanted = new Set(ids.map(String));

  for (const call of [...audio, ...video]) {
    const parts = (call.participants ?? []).map((p) => String(p));
    if (parts.length > 0) {
      for (const p of parts) {
        if (wanted.has(p)) busy.add(p);
      }
      continue;
    }
    // Legacy: no participants array populated.
    const legacy = [String(call.caller), String(call.callee)];
    for (const p of legacy) {
      if (wanted.has(p)) busy.add(p);
    }
  }
  return busy;
}
