import type { FaceBox } from '../types';
import { DEFAULT_FACE_BOX, heuristicFaceBox } from '../layout';

/**
 * Face tracking abstraction — swap Heuristic ↔ MediaPipe / ML Kit without UI changes.
 */
export interface FaceTrackingEngine {
  detect(frameWidth: number, frameHeight: number): Promise<FaceBox | null>;
  dispose?(): void;
}

export { DEFAULT_FACE_BOX };

export class HeuristicFaceTrackingEngine implements FaceTrackingEngine {
  async detect(): Promise<FaceBox | null> {
    return heuristicFaceBox();
  }
}

export class MediaPipeFaceTrackingEngine implements FaceTrackingEngine {
  async detect(): Promise<FaceBox | null> {
    return heuristicFaceBox();
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
