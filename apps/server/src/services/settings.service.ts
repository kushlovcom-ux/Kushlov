import { Settings, ISettings } from '../models';

/** Fetch (or lazily create) the single global settings document. */
export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne({ key: 'global' });
  if (!settings) {
    settings = await Settings.create({
      key: 'global',
      diamondPackages: [
        { id: 'starter', label: 'Starter', diamonds: 100, bonus: 0, price: 0.99, priceUsd: 0.99, priceInr: 79, currency: 'USD', isActive: true },
        { id: 'popular', label: 'Popular', diamonds: 550, bonus: 50, price: 4.99, priceUsd: 4.99, priceInr: 399, currency: 'USD', isActive: true },
        { id: 'pro', label: 'Pro', diamonds: 1200, bonus: 200, price: 9.99, priceUsd: 9.99, priceInr: 799, currency: 'USD', isActive: true },
        { id: 'whale', label: 'Elite', diamonds: 6500, bonus: 1500, price: 49.99, priceUsd: 49.99, priceInr: 3999, currency: 'USD', isActive: true },
      ],
      landing: {
        membersLabel: '120k+',
        verifiedHostsLabel: '8k+',
        liveRoomsLabel: '24/7',
      },
    });
  }

  // Backfill new fields on existing documents without wiping admin values.
  let dirty = false;
  if (settings.rates.videoSecondsPerDiamond == null) {
    settings.rates.videoSecondsPerDiamond = 60;
    dirty = true;
  }
  if (settings.rates.audioSecondsPerDiamond == null) {
    settings.rates.audioSecondsPerDiamond = 120;
    dirty = true;
  }
  if (settings.rates.messagesPerDiamond == null) {
    settings.rates.messagesPerDiamond = 5;
    dirty = true;
  }
  if (!settings.rates.videoTimeUnit) {
    settings.rates.videoTimeUnit = 'minute';
    dirty = true;
  }
  if (!settings.rates.audioTimeUnit) {
    settings.rates.audioTimeUnit = 'minute';
    dirty = true;
  }
  if (settings.rates.userUserVideoSecondsPerDiamond == null) {
    settings.rates.userUserVideoSecondsPerDiamond = 90;
    dirty = true;
  }
  if (settings.rates.userUserAudioSecondsPerDiamond == null) {
    settings.rates.userUserAudioSecondsPerDiamond = 180;
    dirty = true;
  }
  if (!settings.rates.userUserVideoTimeUnit) {
    settings.rates.userUserVideoTimeUnit = 'minute';
    dirty = true;
  }
  if (!settings.rates.userUserAudioTimeUnit) {
    settings.rates.userUserAudioTimeUnit = 'minute';
    dirty = true;
  }
  if (settings.rates.userUserMessagesPerDiamond == null) {
    settings.rates.userUserMessagesPerDiamond = 10;
    dirty = true;
  }
  if (settings.rates.hostHostVideoSecondsPerDiamond == null) {
    settings.rates.hostHostVideoSecondsPerDiamond = 60;
    dirty = true;
  }
  if (settings.rates.hostHostAudioSecondsPerDiamond == null) {
    settings.rates.hostHostAudioSecondsPerDiamond = 120;
    dirty = true;
  }
  if (!settings.rates.hostHostVideoTimeUnit) {
    settings.rates.hostHostVideoTimeUnit = 'minute';
    dirty = true;
  }
  if (!settings.rates.hostHostAudioTimeUnit) {
    settings.rates.hostHostAudioTimeUnit = 'minute';
    dirty = true;
  }
  if (settings.rates.hostHostMessagesPerDiamond == null) {
    settings.rates.hostHostMessagesPerDiamond = 5;
    dirty = true;
  }
  if (settings.features.reviewsEnabled == null) {
    settings.features.reviewsEnabled = true;
    dirty = true;
  }
  if (dirty) await settings.save();

  return settings;
}

export type TimeUnit = 'second' | 'minute' | 'hour';

export function timeUnitToSeconds(value: number, unit: TimeUnit): number {
  if (unit === 'hour') return Math.max(1, Math.round(value * 3600));
  if (unit === 'minute') return Math.max(1, Math.round(value * 60));
  return Math.max(1, Math.round(value));
}

export function secondsToTimeUnit(seconds: number, unit: TimeUnit): number {
  if (unit === 'hour') return Math.round((seconds / 3600) * 100) / 100;
  if (unit === 'minute') return Math.round((seconds / 60) * 100) / 100;
  return seconds;
}

export function formatDiamondCallTime(seconds: number, unit: TimeUnit): string {
  const value = secondsToTimeUnit(seconds, unit);
  const label = unit === 'hour' ? 'hour' : unit === 'minute' ? 'minute' : 'second';
  const plural = value === 1 ? label : `${label}s`;
  return `${value} ${plural}`;
}
