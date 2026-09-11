import type { BeautySettings } from './types.js';

/** Neutral: no smoothing, no exposure lift, no temperature shift. */
export const DEFAULT_BEAUTY: BeautySettings = {
  skinSmoothing: 0,
  brightness: 0,
  warmth: 0.5,
};

/** Discrete steps the UI offers, matching the 0/25/50/75/100% spec. */
export const BEAUTY_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampBeauty(settings: Partial<BeautySettings>): BeautySettings {
  return {
    skinSmoothing: clamp01(settings.skinSmoothing ?? DEFAULT_BEAUTY.skinSmoothing),
    brightness: clamp01(settings.brightness ?? DEFAULT_BEAUTY.brightness),
    warmth: clamp01(settings.warmth ?? DEFAULT_BEAUTY.warmth),
  };
}

export function mergeBeauty(
  base: BeautySettings,
  patch: Partial<BeautySettings> | undefined,
): BeautySettings {
  if (!patch) return base;
  return clampBeauty({ ...base, ...patch });
}

export function isBeautyActive(settings: BeautySettings): boolean {
  return (
    settings.skinSmoothing > 0.001 ||
    settings.brightness > 0.001 ||
    Math.abs(settings.warmth - 0.5) > 0.001
  );
}
