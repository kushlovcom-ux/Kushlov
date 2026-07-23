'use client';

import { useEffect, useRef, useState } from 'react';

export type FaceBox = {
  /** Center X as % of container width */
  cx: number;
  /** Center Y as % of container height */
  cy: number;
  /** Width as % of container width */
  width: number;
  /** Height as % of container height */
  height: number;
  /** Rotation in degrees */
  rotation: number;
};

/** Default selfie face region when ML is unavailable. */
export const DEFAULT_FACE_BOX: FaceBox = {
  cx: 50,
  cy: 36,
  width: 42,
  height: 48,
  rotation: 0,
};

type Landmark = { x: number; y: number; z?: number };

function boxFromLandmarks(landmarks: Landmark[], mirrored: boolean): FaceBox {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of landmarks) {
    const x = mirrored ? 1 - p.x : p.x;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const width = Math.max(0.12, (maxX - minX) * 100);
  const height = Math.max(0.14, (maxY - minY) * 100);
  const cx = ((minX + maxX) / 2) * 100;
  const cy = ((minY + maxY) / 2) * 100;

  // Eyes roughly at indices 33 (right) and 263 (left) in MediaPipe face mesh
  const rightEye = landmarks[33];
  const leftEye = landmarks[263];
  let rotation = 0;
  if (rightEye && leftEye) {
    const rx = mirrored ? 1 - rightEye.x : rightEye.x;
    const lx = mirrored ? 1 - leftEye.x : leftEye.x;
    rotation = (Math.atan2(leftEye.y - rightEye.y, lx - rx) * 180) / Math.PI;
  }

  return { cx, cy, width, height, rotation };
}

let landmarkerPromise: Promise<{
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { faceLandmarks?: Landmark[][] };
  close?: () => void;
} | null> | null = null;

async function getFaceLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
        );
        const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        return landmarker;
      } catch {
        return null;
      }
    })();
  }
  return landmarkerPromise;
}

/**
 * Tracks the primary face inside a container that holds a <video>.
 * Falls back to a selfie-style face box when MediaPipe is unavailable.
 */
export function useFaceBox(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  mirrored = false,
): FaceBox {
  const [box, setBox] = useState<FaceBox>(DEFAULT_FACE_BOX);
  const lastTs = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setBox(DEFAULT_FACE_BOX);
      return;
    }

    let cancelled = false;
    let raf = 0;

    const loop = async () => {
      if (cancelled) return;
      const container = containerRef.current;
      const video = container?.querySelector('video') as HTMLVideoElement | null;
      if (!video || video.readyState < 2) {
        raf = requestAnimationFrame(() => void loop());
        return;
      }

      try {
        const landmarker = await getFaceLandmarker();
        if (cancelled) return;
        if (landmarker) {
          const now = performance.now();
          if (now - lastTs.current > 33) {
            lastTs.current = now;
            const result = landmarker.detectForVideo(video, now);
            const face = result.faceLandmarks?.[0];
            if (face?.length) {
              setBox(boxFromLandmarks(face, mirrored));
            }
          }
        }
      } catch {
        // keep last / default box
      }

      raf = requestAnimationFrame(() => void loop());
    };

    raf = requestAnimationFrame(() => void loop());
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [containerRef, enabled, mirrored]);

  return box;
}
