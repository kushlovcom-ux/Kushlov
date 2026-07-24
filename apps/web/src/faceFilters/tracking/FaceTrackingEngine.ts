import type { FaceBox, FaceLandmarkPoint } from '../types';

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

export const DEFAULT_FACE_BOX: FaceBox = {
  cx: 0.5,
  cy: 0.36,
  width: 0.42,
  height: 0.48,
  rotation: 0,
};

export function boxFromLandmarks(
  landmarks: FaceLandmarkPoint[],
  mirrored = false,
): FaceBox {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  const pts = landmarks.map((p) => ({
    x: mirrored ? 1 - p.x : p.x,
    y: p.y,
    z: p.z,
  }));
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const rightEye = landmarks[33];
  const leftEye = landmarks[263];
  let rotation = 0;
  if (rightEye && leftEye) {
    const rx = mirrored ? 1 - rightEye.x : rightEye.x;
    const lx = mirrored ? 1 - leftEye.x : leftEye.x;
    rotation = (Math.atan2(leftEye.y - rightEye.y, lx - rx) * 180) / Math.PI;
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: Math.max(0.12, maxX - minX),
    height: Math.max(0.14, maxY - minY),
    rotation,
    landmarks: pts,
  };
}

/** Abstract tracking engine — swap MediaPipe later without UI changes. */
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
    if (now - this.lastTs < 28) return this.lastBox;
    this.lastTs = now;
    try {
      const result = landmarker.detectForVideo(video, now);
      const face = result.faceLandmarks?.[0];
      if (!face?.length) {
        this.lastBox = null;
        return null;
      }
      this.lastBox = boxFromLandmarks(face, mirrored);
      return this.lastBox;
    } catch {
      return this.lastBox;
    }
  }
}
