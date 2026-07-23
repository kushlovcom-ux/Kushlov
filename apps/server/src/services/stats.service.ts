import { CallStatus, LiveStatus, Role } from '@kushlov/types';
import {
  AudioCall,
  Conversation,
  LiveStream,
  User,
  VideoCall,
} from '../models';
import { getSettings } from './settings.service';
import { onlineUserFilter, sweepStalePresence } from './presence.service';

const ACTIVE_CHAT_MS = 15 * 60 * 1000;

/** Platform-wide live activity counts for landing page and feature cards. */
export async function getPublicPlatformStats() {
  await sweepStalePresence();

  const since = new Date(Date.now() - ACTIVE_CHAT_MS);
  const [liveOnline, audioCalls, videoCalls, activeChats, onlineUsers, settings] =
    await Promise.all([
      LiveStream.countDocuments({ status: LiveStatus.Live }),
      AudioCall.countDocuments({ status: CallStatus.Ongoing }),
      VideoCall.countDocuments({ status: CallStatus.Ongoing }),
      Conversation.countDocuments({ lastMessageAt: { $gte: since } }),
      User.countDocuments({
        status: 'active',
        role: { $in: [Role.User, Role.Host] },
        ...onlineUserFilter(),
      }),
      getSettings(),
    ]);

  // Hosts who are online and currently live streaming
  const liveHostIds = await LiveStream.find({ status: LiveStatus.Live }).distinct('host');
  const liveOnlineHosts = liveHostIds.length
    ? await User.countDocuments({ _id: { $in: liveHostIds }, isOnline: true, role: Role.Host })
    : 0;

  return {
    onlineUsers,
    liveStreams: Math.max(liveOnlineHosts, liveOnline),
    activeAudioCalls: audioCalls,
    activeVideoCalls: videoCalls,
    activeChats,
    landing: settings.landing ?? {
      membersLabel: '120k+',
      verifiedHostsLabel: '8k+',
      liveRoomsLabel: '24/7',
    },
  };
}
