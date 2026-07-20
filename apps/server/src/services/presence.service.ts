import { User } from '../models';

/** Consider someone online if they pinged / connected within this window. */
export const PRESENCE_ONLINE_MS = 90_000;

/** Mark the user online (HTTP heartbeat or socket). */
export async function touchPresence(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, {
    isOnline: true,
    lastSeenAt: new Date(),
  });
}

/** Mark stale users offline (lastSeen older than window). */
export async function sweepStalePresence(): Promise<void> {
  const cutoff = new Date(Date.now() - PRESENCE_ONLINE_MS);
  await User.updateMany(
    {
      isOnline: true,
      $or: [{ lastSeenAt: { $lt: cutoff } }, { lastSeenAt: { $exists: false } }],
    },
    { $set: { isOnline: false } },
  );
}

/** Mongo filter for currently-online users. */
export function onlineUserFilter(): Record<string, unknown> {
  const cutoff = new Date(Date.now() - PRESENCE_ONLINE_MS);
  return {
    $or: [{ isOnline: true, lastSeenAt: { $gte: cutoff } }, { lastSeenAt: { $gte: cutoff } }],
  };
}

export function computeIsOnline(user: { isOnline?: boolean; lastSeenAt?: Date | string | null }): boolean {
  if (!user.lastSeenAt) return !!user.isOnline;
  const ts = new Date(user.lastSeenAt).getTime();
  if (Number.isNaN(ts)) return !!user.isOnline;
  return Date.now() - ts < PRESENCE_ONLINE_MS;
}
