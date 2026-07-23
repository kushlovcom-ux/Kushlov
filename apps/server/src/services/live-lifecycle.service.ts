import { LiveStatus, SocketEvents } from '@kushlov/types';
import { LiveStream, User } from '../models';
import type { ILiveStream } from '../models/live.model';
import { closeRoom, isIdentityInRoom } from './livekit.service';
import { emitToRoom } from '../socket/io';

const roomOf = (id: string) => `live:${id}`;

/** Grace window after start so the host can connect to LiveKit before we prune. */
const LIVE_CONNECT_GRACE_MS = 90_000;

export async function markLiveEnded(live: ILiveStream): Promise<void> {
  if (live.status === LiveStatus.Ended) return;
  live.status = LiveStatus.Ended;
  live.endedAt = new Date();
  await live.save();
  try {
    await closeRoom(live.roomName);
  } catch {
    /* ignore */
  }
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveLeave, { ended: true });
}

/** End every open stream for a host (used on re-start and disconnect). */
export async function endOpenLivesForHost(hostId: string): Promise<void> {
  const open = await LiveStream.find({ host: hostId, status: LiveStatus.Live });
  await Promise.all(open.map((live) => markLiveEnded(live)));
}

/**
 * Drop "live" rows whose host is no longer actually streaming.
 * Fixes cards that linger after a host closes the tab without calling /end.
 */
export async function pruneStaleLiveStreams(): Promise<void> {
  const open = await LiveStream.find({ status: LiveStatus.Live }).select(
    '_id host roomName status startedAt createdAt',
  );
  if (open.length === 0) return;

  await Promise.all(
    open.map(async (live) => {
      const startedAt = live.startedAt?.getTime() ?? live.createdAt?.getTime() ?? 0;
      if (startedAt && Date.now() - startedAt < LIVE_CONNECT_GRACE_MS) return;

      const hostId = live.host.toString();
      const present = await isIdentityInRoom(live.roomName, hostId);
      if (present === false) {
        await markLiveEnded(live);
        return;
      }

      // LiveKit unavailable: fall back to host presence.
      if (present === null) {
        const host = await User.findById(hostId).select('isOnline');
        if (host && !host.isOnline) await markLiveEnded(live);
      }
    }),
  );
}
