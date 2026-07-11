import { Router } from 'express';
import { Role } from '@kushlov/types';
import {
  formatDiamondCallTime,
  getSettings,
  secondsToTimeUnit,
  type TimeUnit,
} from '../../services/settings.service';
import { getLiveKitPublicUrl, hasLiveKit } from '../../config/env';
import { getPublicPlatformStats } from '../../services/stats.service';
import { User } from '../../models';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';

const router = Router();

function callConversion(
  seconds: number,
  unit: TimeUnit,
  audience: string,
  kind: 'video' | 'audio',
) {
  return {
    secondsPerDiamond: seconds,
    unit,
    value: secondsToTimeUnit(seconds, unit),
    label: `1 Diamond = ${formatDiamondCallTime(seconds, unit)} ${kind} with ${audience}`,
  };
}

/** GET /settings — public, client-safe platform settings. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const s = await getSettings();
    const videoUnit = (s.rates.videoTimeUnit ?? 'minute') as TimeUnit;
    const audioUnit = (s.rates.audioTimeUnit ?? 'minute') as TimeUnit;
    const videoSeconds = s.rates.videoSecondsPerDiamond || 60;
    const audioSeconds = s.rates.audioSecondsPerDiamond || 120;
    const uuVideoUnit = (s.rates.userUserVideoTimeUnit ?? 'minute') as TimeUnit;
    const uuAudioUnit = (s.rates.userUserAudioTimeUnit ?? 'minute') as TimeUnit;
    const uuVideoSeconds = s.rates.userUserVideoSecondsPerDiamond || 90;
    const uuAudioSeconds = s.rates.userUserAudioSecondsPerDiamond || 180;
    const hhVideoUnit = (s.rates.hostHostVideoTimeUnit ?? 'minute') as TimeUnit;
    const hhAudioUnit = (s.rates.hostHostAudioTimeUnit ?? 'minute') as TimeUnit;
    const hhVideoSeconds = s.rates.hostHostVideoSecondsPerDiamond || 60;
    const hhAudioSeconds = s.rates.hostHostAudioSecondsPerDiamond || 120;
    const huVideoUnit = (s.rates.hostUserVideoTimeUnit ?? 'minute') as TimeUnit;
    const huAudioUnit = (s.rates.hostUserAudioTimeUnit ?? 'minute') as TimeUnit;
    const huVideoSeconds = s.rates.hostUserVideoSecondsPerDiamond || 60;
    const huAudioSeconds = s.rates.hostUserAudioSecondsPerDiamond || 120;

    return ok(res, {
      rates: s.rates,
      diamondConversions: {
        hostVideo: callConversion(videoSeconds, videoUnit, 'hosts', 'video'),
        hostAudio: callConversion(audioSeconds, audioUnit, 'hosts', 'audio'),
        hostMessages: {
          messagesPerDiamond: s.rates.messagesPerDiamond || 5,
          label: `1 Diamond = ${s.rates.messagesPerDiamond || 5} messages with hosts`,
        },
        userVideo: callConversion(uuVideoSeconds, uuVideoUnit, 'users', 'video'),
        userAudio: callConversion(uuAudioSeconds, uuAudioUnit, 'users', 'audio'),
        userMessages: {
          messagesPerDiamond: s.rates.userUserMessagesPerDiamond || 10,
          label: `1 Diamond = ${s.rates.userUserMessagesPerDiamond || 10} messages with users`,
        },
        hostHostVideo: callConversion(hhVideoSeconds, hhVideoUnit, 'hosts', 'video'),
        hostHostAudio: callConversion(hhAudioSeconds, hhAudioUnit, 'hosts', 'audio'),
        hostHostMessages: {
          messagesPerDiamond: s.rates.hostHostMessagesPerDiamond || 5,
          label: `1 Diamond = ${s.rates.hostHostMessagesPerDiamond || 5} messages host → host`,
        },
        hostUserVideo: callConversion(huVideoSeconds, huVideoUnit, 'users', 'video'),
        hostUserAudio: callConversion(huAudioSeconds, huAudioUnit, 'users', 'audio'),
        hostUserMessages: {
          messagesPerDiamond: s.rates.hostUserMessagesPerDiamond || 5,
          label: `1 Diamond = ${s.rates.hostUserMessagesPerDiamond || 5} messages host → user`,
        },
        video: {
          label: `1 Diamond = ${formatDiamondCallTime(videoSeconds, videoUnit)} of video call (hosts)`,
        },
        audio: {
          label: `1 Diamond = ${formatDiamondCallTime(audioSeconds, audioUnit)} of audio call (hosts)`,
        },
        messages: {
          label: `1 Diamond = ${s.rates.messagesPerDiamond || 5} messages (hosts)`,
        },
      },
      goldConversionRatio: s.goldConversionRatio,
      diamondPackages: s.diamondPackages.filter((p) => p.isActive),
      withdraw: { minGold: s.withdraw.minGold, currency: s.withdraw.currency },
      features: s.features,
      announcements: s.announcements.filter((a) => a.active),
      livekitEnabled: hasLiveKit,
      livekitUrl: getLiveKitPublicUrl(),
    });
  }),
);

/** GET /settings/stats — public live activity + landing stat labels. */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    return ok(res, await getPublicPlatformStats());
  }),
);

/** GET /settings/popular-hosts — admin-curated popular hosts for the landing page. */
router.get(
  '/popular-hosts',
  asyncHandler(async (_req, res) => {
    const hosts = await User.find({
      role: Role.Host,
      isHostApproved: true,
      isPopularHost: true,
      status: 'active',
    })
      .sort({ popularSortOrder: 1, averageRating: -1, totalReviews: -1 })
      .limit(24);
    return ok(res, {
      items: hosts.map((h) => (h as any).toPublic()),
    });
  }),
);

export default router;
