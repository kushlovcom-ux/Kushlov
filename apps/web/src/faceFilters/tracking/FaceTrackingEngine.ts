import type { FaceBox, FaceLandmarkPoint } from '../types';
import { DEFAULT_FACE_BOX, enrichFaceBox, smoothBox } from '../layout';

type Landmarker = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { faceLandmarks?: FaceLandmarkPoint[][] };
  close?: () => void;
};

let landmarkerPromise: Promise<Landmarker | null> | null = null;

async function createLandmarker(): Promise<Landmarker | null> {
  try {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    );
    return vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  } catch {
    return null;
  }
}

export function getFaceLandmarker() {
  if (!landmarkerPromise) landmarkerPromise = createLandmarker();
  return landmarkerPromise;
}

export { DEFAULT_FACE_BOX };

export function boxFromLandmarks(
  landmarks: FaceLandmarkPoint[],
  mirrored = false,
): FaceBox {
  return enrichFaceBox(landmarks, mirrored);
}

/** MediaPipe tracker with Snapchat-style smoothing. */
export class FaceTrackingEngine {
  private lastTs = 0;
  private lastBox: FaceBox | null = null;

  async detect(video: HTMLVideoElement, mirrored = false): Promise<FaceBox | null> {
    if (video.readyState < 2) return this.lastBox;
    const landmarker = await getFaceLandmarker();
    if (!landmarker) {
      this.lastBox = DEFAULT_FACE_BOX;
      return this.lastBox;
    }
    const now = performance.now();
    if (now - this.lastTs < 24) return this.lastBox;
    this.lastTs = now;
    try {
      const result = landmarker.detectForVideo(video, now);
      const face = result.faceLandmarks?.[0];
      if (!face?.length) {
        this.lastBox = null;
        return null;
      }
      const next = boxFromLandmarks(face, mirrored);
      this.lastBox = smoothBox(this.lastBox, next, 0.45);
      return this.lastBox;
    } catch {
      return this.lastBox;
    }
  }
}
