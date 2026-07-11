import { CallType, Role } from '@kushlov/types';
import { ISettings } from '../models/settings.model';
import { IUser } from '../models/user.model';
import { getSettings } from './settings.service';

export type HostPricingFields = {
  videoPrice?: number;
  audioPrice?: number;
  messagePrice?: number;
  role?: Role;
};

/** Call billing peer kind. */
export type CallPeerKind = 'host' | 'user' | 'hostHost';

/** Convert admin gold price → diamonds the caller must spend. */
export function goldPriceToDiamonds(goldPrice: number, goldConversionRatio: number): number {
  if (goldPrice <= 0) return 0;
  const ratio = goldConversionRatio > 0 ? goldConversionRatio : 0.5;
  return Math.max(1, Math.ceil(goldPrice / ratio));
}

/**
 * Resolve diamonds-per-minute for a call.
 * Host custom prices are stored as gold/min and converted to diamonds.
 * User↔user and host↔host use conversion-only (rate 0).
 */
export function resolveCallRatePerMinute(
  settings: ISettings,
  peer: HostPricingFields,
  type: CallType,
  peerKind: CallPeerKind,
): number {
  if (peerKind === 'user' || peerKind === 'hostHost') return 0;

  const ratio = settings.goldConversionRatio ?? 0.5;
  if (type === CallType.Video) {
    if (peer.videoPrice != null && peer.videoPrice > 0) {
      return goldPriceToDiamonds(peer.videoPrice, ratio);
    }
    return settings.rates.videoCallPerMinute ?? 20;
  }
  if (peer.audioPrice != null && peer.audioPrice > 0) {
    return goldPriceToDiamonds(peer.audioPrice, ratio);
  }
  return settings.rates.audioCallPerMinute ?? 10;
}

/** Seconds of call time granted per diamond for the peer kind. */
export function resolveSecondsPerDiamond(
  settings: ISettings,
  type: CallType,
  peerKind: CallPeerKind = 'host',
): number {
  if (peerKind === 'hostHost') {
    if (type === CallType.Video) {
      return settings.rates.hostHostVideoSecondsPerDiamond > 0
        ? settings.rates.hostHostVideoSecondsPerDiamond
        : 60;
    }
    return settings.rates.hostHostAudioSecondsPerDiamond > 0
      ? settings.rates.hostHostAudioSecondsPerDiamond
      : 120;
  }
  if (peerKind === 'user') {
    if (type === CallType.Video) {
      return settings.rates.userUserVideoSecondsPerDiamond > 0
        ? settings.rates.userUserVideoSecondsPerDiamond
        : 90;
    }
    return settings.rates.userUserAudioSecondsPerDiamond > 0
      ? settings.rates.userUserAudioSecondsPerDiamond
      : 180;
  }
  if (type === CallType.Video) {
    return settings.rates.videoSecondsPerDiamond > 0
      ? settings.rates.videoSecondsPerDiamond
      : 60;
  }
  return settings.rates.audioSecondsPerDiamond > 0
    ? settings.rates.audioSecondsPerDiamond
    : 120;
}

export function maxAffordableCallSeconds(params: {
  diamonds: number;
  ratePerMinute: number;
  secondsPerDiamond: number;
}): number {
  const { diamonds, ratePerMinute, secondsPerDiamond } = params;
  if (diamonds <= 0) return 0;

  const byMinute =
    ratePerMinute > 0 ? Math.floor(diamonds / ratePerMinute) * 60 : Number.POSITIVE_INFINITY;
  const byConversion =
    secondsPerDiamond > 0 ? diamonds * secondsPerDiamond : Number.POSITIVE_INFINITY;

  const max = Math.min(byMinute, byConversion);
  return Number.isFinite(max) ? Math.max(0, max) : 0;
}

export function computeCallDiamondCost(params: {
  durationSec: number;
  ratePerMinute: number;
  secondsPerDiamond: number;
}): number {
  const { durationSec, ratePerMinute, secondsPerDiamond } = params;
  if (durationSec <= 0) return 0;

  if (ratePerMinute > 0) {
    const minutes = Math.ceil(durationSec / 60);
    return minutes * ratePerMinute;
  }
  if (secondsPerDiamond > 0) {
    return Math.ceil(durationSec / secondsPerDiamond);
  }
  return 0;
}

/**
 * Message billing plan.
 * Host: messagePrice is gold/msg → diamonds; else messagesPerDiamond.
 * User↔user / host↔host: messages-per-diamond credits.
 */
export async function resolveMessageBilling(
  recipient: HostPricingFields,
  peerKind: CallPeerKind,
): Promise<{
  diamondsPerMessage: number;
  messagesPerDiamond: number;
}> {
  const settings = await getSettings();

  if (peerKind === 'user') {
    const n =
      settings.rates.userUserMessagesPerDiamond > 0
        ? settings.rates.userUserMessagesPerDiamond
        : 10;
    return { diamondsPerMessage: 0, messagesPerDiamond: Math.max(1, Math.floor(n)) };
  }

  if (peerKind === 'hostHost') {
    const n =
      settings.rates.hostHostMessagesPerDiamond > 0
        ? settings.rates.hostHostMessagesPerDiamond
        : 5;
    return { diamondsPerMessage: 0, messagesPerDiamond: Math.max(1, Math.floor(n)) };
  }

  const hostGoldPrice = recipient.messagePrice ?? 0;
  if (hostGoldPrice > 0) {
    return {
      diamondsPerMessage: goldPriceToDiamonds(hostGoldPrice, settings.goldConversionRatio ?? 0.5),
      messagesPerDiamond: 0,
    };
  }
  const messagesPerDiamond =
    settings.rates.messagesPerDiamond > 0
      ? settings.rates.messagesPerDiamond
      : settings.rates.chatPerMessage > 0
        ? 1 / settings.rates.chatPerMessage
        : 1;
  if (settings.rates.chatPerMessage > 1 && !(settings.rates.messagesPerDiamond > 0)) {
    return { diamondsPerMessage: settings.rates.chatPerMessage, messagesPerDiamond: 0 };
  }
  return {
    diamondsPerMessage: 0,
    messagesPerDiamond: Math.max(1, Math.floor(messagesPerDiamond)),
  };
}

export function isApprovedHost(user: Pick<IUser, 'role' | 'isHostApproved'>): boolean {
  return user.role === Role.Host && user.isHostApproved === true;
}

export function peerKindForRoles(callerRole: Role, calleeRole: Role): CallPeerKind | null {
  if (callerRole === Role.User && calleeRole === Role.Host) return 'host';
  if (callerRole === Role.User && calleeRole === Role.User) return 'user';
  if (callerRole === Role.Host && calleeRole === Role.Host) return 'hostHost';
  return null;
}

/** @deprecated use peerKindForRoles */
export function peerKindForRole(role: Role): CallPeerKind | null {
  if (role === Role.Host) return 'host';
  if (role === Role.User) return 'user';
  return null;
}
