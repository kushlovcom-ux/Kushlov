import { requireOptionalNativeModule } from 'expo';
import type { EventSubscription } from 'expo-modules-core';

export type NativeFaceEvent = {
  detected: boolean;
  cx?: number;
  cy?: number;
  width?: number;
  height?: number;
  rotation?: number;
  eyeCx?: number;
  eyeCy?: number;
  eyeW?: number;
  foreheadCx?: number;
  foreheadCy?: number;
  mouthCx?: number;
  mouthCy?: number;
  noseCx?: number;
  noseCy?: number;
};

/**
 * Effects baked into the published camera track by the native frame processor,
 * so remote participants see them too.
 */
export type NativeVideoEffectConfig = {
  /** Edge-aware skin smoothing, 0–1. */
  beauty: number;
  /** Exposure lift, 0–1. */
  brightness: number;
  background: 'none' | 'blur' | 'color';
  /** Packed 0xRRGGBB, top of the background gradient. */
  topColor: number;
  bottomColor: number;
  /** How strongly the background replaces the original pixels, 0–1. */
  backgroundStrength: number;
};

export const NO_NATIVE_VIDEO_EFFECTS: NativeVideoEffectConfig = {
  beauty: 0,
  brightness: 0,
  background: 'none',
  topColor: 0x101018,
  bottomColor: 0x05050c,
  backgroundStrength: 0.85,
};

type FaceTrackNative = {
  isAvailable(): boolean;
  attachProcessor?: () => boolean | Promise<boolean>;
  setEffectConfig?: (config: NativeVideoEffectConfig) => boolean;
  addListener(
    event: 'onFace',
    listener: (event: NativeFaceEvent) => void,
  ): EventSubscription;
};

const native = requireOptionalNativeModule<FaceTrackNative>('KushlovFaceTrack');

/** WebRTC video-effect processor name registered natively. */
export const FACE_TRACK_EFFECT = 'kushlovFace';

export function isFaceTrackNativeAvailable(): boolean {
  return native != null;
}

export async function ensureFaceProcessorRegistered(): Promise<boolean> {
  if (!native) return false;
  try {
    if (typeof native.attachProcessor === 'function') {
      await native.attachProcessor();
    }
    return true;
  } catch {
    return false;
  }
}

/** True when this build can bake beauty/background into the published track. */
export function isNativeVideoEffectsSupported(): boolean {
  return typeof native?.setEffectConfig === 'function';
}

/**
 * Push effect parameters to the frame processor. Returns false when the native
 * module is unavailable (Expo Go, iOS, older build) so callers can fall back to
 * the local overlay instead of silently showing nothing.
 */
export function setNativeVideoEffects(config: NativeVideoEffectConfig): boolean {
  if (typeof native?.setEffectConfig !== 'function') return false;
  try {
    native.setEffectConfig(config);
    return true;
  } catch {
    return false;
  }
}

export function clearNativeVideoEffects(): void {
  setNativeVideoEffects(NO_NATIVE_VIDEO_EFFECTS);
}

export function subscribeNativeFace(
  listener: (event: NativeFaceEvent) => void,
): () => void {
  if (!native) return () => undefined;
  const sub: EventSubscription = native.addListener('onFace', listener);
  return () => sub.remove();
}
