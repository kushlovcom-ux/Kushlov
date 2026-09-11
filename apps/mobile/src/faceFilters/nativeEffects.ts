import {
  NO_NATIVE_VIDEO_EFFECTS,
  type NativeVideoEffectConfig,
} from 'kushlov-face-track';
import { getFilterDef } from './catalog';
import type { FaceFilterDef, FaceFilterId } from './types';

type BackgroundPreset = Pick<
  NativeVideoEffectConfig,
  'background' | 'topColor' | 'bottomColor' | 'backgroundStrength'
>;

/**
 * Colours mirror the RN gradient presets in FaceFilterOverlay so a device that
 * can bake the background natively looks the same as one that cannot.
 * Strength is higher here because native only recolours segmented background
 * pixels, whereas the overlay tints the whole frame including the person.
 */
const BACKGROUND_PRESETS: Record<
  NonNullable<FaceFilterDef['background']>,
  BackgroundPreset
> = {
  blur: { background: 'blur', topColor: 0x101018, bottomColor: 0x05050c, backgroundStrength: 0.92 },
  dim: { background: 'color', topColor: 0x000000, bottomColor: 0x000000, backgroundStrength: 0.58 },
  sunset: { background: 'color', topColor: 0xff7e5f, bottomColor: 0x50143c, backgroundStrength: 0.88 },
  night: { background: 'color', topColor: 0x0a1638, bottomColor: 0x020612, backgroundStrength: 0.92 },
  studio: { background: 'color', topColor: 0xffffff, bottomColor: 0x121218, backgroundStrength: 0.86 },
  neon: { background: 'color', topColor: 0xec4899, bottomColor: 0x22d3ee, backgroundStrength: 0.86 },
};

type BeautyPreset = Pick<NativeVideoEffectConfig, 'beauty' | 'brightness'>;

const BEAUTY_PRESETS: Partial<Record<FaceFilterId, BeautyPreset>> = {
  smoothSkin: { beauty: 0.55, brightness: 0.05 },
  beauty: { beauty: 0.78, brightness: 0.16 },
};

const DEFAULT_BEAUTY: BeautyPreset = { beauty: 0.6, brightness: 0.1 };

/** Native frame-processor parameters for the selected filter. */
export function nativeEffectsFor(
  filterId: string | null | undefined,
): NativeVideoEffectConfig {
  const def = getFilterDef(filterId);
  if (!def) return NO_NATIVE_VIDEO_EFFECTS;

  const beauty = def.beauty ? (BEAUTY_PRESETS[def.id] ?? DEFAULT_BEAUTY) : null;
  const background = def.background ? BACKGROUND_PRESETS[def.background] : null;
  if (!beauty && !background) return NO_NATIVE_VIDEO_EFFECTS;

  return {
    ...NO_NATIVE_VIDEO_EFFECTS,
    ...(beauty ?? {}),
    ...(background ?? {}),
  };
}

/**
 * Whether this filter's look comes from pixel processing rather than a drawn
 * layer. Stickers stay as overlays; beauty and backgrounds do not, so the
 * overlay must not paint its approximation on top of the processed frame.
 */
export function isPixelEffectFilter(filterId: string | null | undefined): boolean {
  const def = getFilterDef(filterId);
  return Boolean(def && (def.beauty || def.background));
}
