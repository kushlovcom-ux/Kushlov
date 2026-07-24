import type { FaceBox } from '../types';

/**
 * Face tracking abstraction — swap Heuristic ↔ MediaPipe / ML Kit without UI changes.
 * Native ML engines plug in via EAS / dev client.
 */
export interface FaceTrackingEngine {
  detect(frameWidth: number, frameHeight: number): Promise<FaceBox | null>;
  dispose?(): void;
}

/** Default box for selfie framing when ML is unavailable (Expo Go / no native module). */
export const DEFAULT_FACE_BOX: FaceBox = {
  cx: 0.5,
  cy: 0.34,
  width: 0.42,
  height: 0.48,
  rotation: 0,
};

export class HeuristicFaceTrackingEngine implements FaceTrackingEngine {
  async detect(): Promise<FaceBox | null> {
    return DEFAULT_FACE_BOX;
  }
}

/**
 * Placeholder for MediaPipe / ML Kit on EAS builds.
 * Register via `setFaceTrackingEngineFactory` after native module load.
 */
export class MediaPipeFaceTrackingEngine implements FaceTrackingEngine {
  async detect(): Promise<FaceBox | null> {
    // Native bridge not linked — fall back to heuristic.
    return DEFAULT_FACE_BOX;
  }
}

type Factory = () => FaceTrackingEngine;

let factory: Factory = () => new HeuristicFaceTrackingEngine();

export function setFaceTrackingEngineFactory(next: Factory) {
  factory = next;
}

export function createFaceTrackingEngine(): FaceTrackingEngine {
  return factory();
}
