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

type FaceTrackNative = {
  isAvailable(): boolean;
  attachProcessor?: () => boolean | Promise<boolean>;
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

export function subscribeNativeFace(
  listener: (event: NativeFaceEvent) => void,
): () => void {
  if (!native) return () => undefined;
  const sub: EventSubscription = native.addListener('onFace', listener);
  return () => sub.remove();
}
