import { Types } from 'mongoose';
import { CallStatus } from '@kushlov/types';
import { AudioCall, VideoCall } from '../models';

/**
 * Users currently on an ongoing audio/video call (caller or callee).
 * Used to show "Busy" on Discover cards.
 */
export async function getBusyUserIds(
  userIds: (string | Types.ObjectId)[],
): Promise<Set<string>> {
  if (!userIds.length) return new Set();

  const ids = userIds.map((id) => new Types.ObjectId(String(id)));
  const filter = {
    status: CallStatus.Ongoing,
    $or: [{ caller: { $in: ids } }, { callee: { $in: ids } }],
  };

  const [audio, video] = await Promise.all([
    AudioCall.find(filter).select('caller callee').lean(),
    VideoCall.find(filter).select('caller callee').lean(),
  ]);

  const busy = new Set<string>();
  for (const call of [...audio, ...video]) {
    busy.add(String(call.caller));
    busy.add(String(call.callee));
  }
  return busy;
}
