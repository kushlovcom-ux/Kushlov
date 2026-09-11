import type { FaceAnchorPoint, FaceTrackingData, FilterAnchor } from '@kushlov/filter-core';

/**
 * MediaPipe Face Landmarker wrapper.
 *
 * Produces normalised, smoothed anchors in source-image space (top-left
 * origin) so the WebGL renderer and a future native renderer can consume the
 * exact same numbers. Detection is throttled below the render rate — the face
 * moves far slower than 60fps and the model is the expensive part.
 */

/** Canonical MediaPipe 468-point mesh indices. */
const LM = {
  forehead: 10,
  chin: 152,
  noseTip: 1,
  rightEyeOuter: 33,
  leftEyeOuter: 263,
  mouthUpper: 13,
  mouthLower: 14,
} as const;

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** ~24fps of inference is plenty; the renderer still runs every frame. */
const DETECT_INTERVAL_MS = 40;
/** Exponential smoothing weight toward the newest measurement. */
const SMOOTHING = 0.45;

type RawPoint = { x: number; y: number; z?: number };

type RawResult = {
  faceLandmarks?: RawPoint[][];
  faceBlendshapes?: { categories?: { categoryName?: string; score?: number }[] }[];
};

type Landmarker = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => RawResult;
  close?: () => void;
};

let landmarkerPromise: Promise<Landmarker | null> | null = null;

/**
 * One model instance per tab. Creating a second Face Landmarker doubles GPU
 * memory and halves throughput, so previews and calls share this.
 */
export function getFaceLandmarker(): Promise<Landmarker | null> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    if (typeof window === 'undefined') return null;
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
      return (await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      })) as unknown as Landmarker;
    } catch {
      // Blocked CDN, no WebGL, or an unsupported browser. Callers fall back to
      // an unfiltered camera rather than failing the call.
      return null;
    }
  })();
  return landmarkerPromise;
}

function anchorsFrom(
  points: RawPoint[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): Record<FilterAnchor, FaceAnchorPoint> {
  const height = Math.max(0.18, bounds.maxY - bounds.minY);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  const at = (index: number): FaceAnchorPoint | null => {
    const p = points[index];
    return p ? { x: p.x, y: p.y } : null;
  };

  const right = at(LM.rightEyeOuter);
  const left = at(LM.leftEyeOuter);
  const forehead = at(LM.forehead);
  const nose = at(LM.noseTip);
  const mouthUpper = at(LM.mouthUpper);
  const mouthLower = at(LM.mouthLower);

  return {
    face: { x: cx, y: cy },
    eyes:
      right && left
        ? { x: (right.x + left.x) / 2, y: (right.y + left.y) / 2 }
        : { x: cx, y: cy - height * 0.1 },
    // Nudge above the hairline landmark so hats and crowns sit on the head.
    forehead: forehead
      ? { x: forehead.x, y: forehead.y - height * 0.08 }
      : { x: cx, y: bounds.minY + height * 0.06 },
    mouth:
      mouthUpper && mouthLower
        ? { x: (mouthUpper.x + mouthLower.x) / 2, y: (mouthUpper.y + mouthLower.y) / 2 }
        : { x: cx, y: cy + height * 0.22 },
    nose: nose ?? { x: cx, y: cy + height * 0.02 },
  };
}

function blendshapesFrom(result: RawResult): Record<string, number> | undefined {
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (!categories?.length) return undefined;
  const out: Record<string, number> = {};
  for (const category of categories) {
    if (category.categoryName) out[category.categoryName] = category.score ?? 0;
  }
  return out;
}

function toTracking(points: RawPoint[], result: RawResult): FaceTrackingData {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const right = points[LM.rightEyeOuter];
  const left = points[LM.leftEyeOuter];
  const roll = right && left ? Math.atan2(left.y - right.y, left.x - right.x) : 0;
  const eyeDistance =
    right && left ? Math.hypot(left.x - right.x, left.y - right.y) : Math.max(0.16, maxX - minX) * 0.5;

  const bounds = { minX, minY, maxX, maxY };
  const blendshapes = blendshapesFrom(result);

  return {
    detected: true,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: Math.max(0.16, maxX - minX),
    height: Math.max(0.18, maxY - minY),
    roll,
    eyeDistance: Math.max(0.05, eyeDistance),
    anchors: anchorsFrom(points, bounds),
    landmarks: points.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
    ...(blendshapes ? { blendshapes } : {}),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPoint(a: FaceAnchorPoint, b: FaceAnchorPoint, t: number): FaceAnchorPoint {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function smooth(prev: FaceTrackingData, next: FaceTrackingData, t: number): FaceTrackingData {
  // Unwrap the roll delta so a wrap past ±π does not spin the accessory.
  let deltaRoll = next.roll - prev.roll;
  while (deltaRoll > Math.PI) deltaRoll -= Math.PI * 2;
  while (deltaRoll < -Math.PI) deltaRoll += Math.PI * 2;

  const anchors = {} as Record<FilterAnchor, FaceAnchorPoint>;
  for (const key of Object.keys(next.anchors) as FilterAnchor[]) {
    anchors[key] = lerpPoint(prev.anchors[key], next.anchors[key], t);
  }

  return {
    ...next,
    cx: lerp(prev.cx, next.cx, t),
    cy: lerp(prev.cy, next.cy, t),
    width: lerp(prev.width, next.width, t),
    height: lerp(prev.height, next.height, t),
    roll: prev.roll + deltaRoll * t,
    eyeDistance: lerp(prev.eyeDistance, next.eyeDistance, t),
    anchors,
  };
}

export class FaceTracker {
  private last: FaceTrackingData | null = null;
  private lastDetectAt = 0;
  private landmarker: Landmarker | null = null;
  private ready = false;
  private missedFrames = 0;

  /** True once the model resolved; false means graceful no-filter fallback. */
  get available(): boolean {
    return this.ready && this.landmarker !== null;
  }

  async initialize(): Promise<boolean> {
    this.landmarker = await getFaceLandmarker();
    this.ready = true;
    return this.landmarker !== null;
  }

  /**
   * Returns the most recent tracking data, running inference at most every
   * DETECT_INTERVAL_MS. Never throws — a detection failure reuses the last
   * good face so accessories hold position instead of flickering off.
   */
  update(video: HTMLVideoElement, nowMs: number): FaceTrackingData | null {
    if (!this.landmarker || video.readyState < 2) return this.last;
    if (nowMs - this.lastDetectAt < DETECT_INTERVAL_MS) return this.last;
    this.lastDetectAt = nowMs;

    try {
      const result = this.landmarker.detectForVideo(video, nowMs);
      const points = result.faceLandmarks?.[0];
      if (!points?.length) {
        this.missedFrames += 1;
        // Hold the last face briefly through blinks and fast turns.
        if (this.missedFrames > 8) this.last = null;
        return this.last;
      }
      this.missedFrames = 0;
      const next = toTracking(points, result);
      this.last = this.last ? smooth(this.last, next, SMOOTHING) : next;
      return this.last;
    } catch {
      return this.last;
    }
  }

  reset(): void {
    this.last = null;
    this.missedFrames = 0;
    this.lastDetectAt = 0;
  }

  /**
   * Drops this tracker's view of the model. The shared Landmarker itself is
   * intentionally left alive for the next call — reloading the 4MB model on
   * every call start is far more costly than keeping it resident.
   */
  dispose(): void {
    this.reset();
    this.landmarker = null;
    this.ready = false;
  }
}
