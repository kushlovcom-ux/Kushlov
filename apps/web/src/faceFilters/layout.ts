import type { FaceBox, FaceFilterDef, FaceLandmarkPoint } from './types';

/** MediaPipe Face Landmarker indices */
export const LM = {
  forehead: 10,
  chin: 152,
  nose: 1,
  rightEye: 33,
  leftEye: 263,
  mouthUpper: 13,
  mouthLower: 14,
} as const;

export const DEFAULT_FACE_BOX: FaceBox = {
  cx: 0.5,
  cy: 0.42,
  width: 0.38,
  height: 0.5,
  rotation: 0,
};

function pt(landmarks: FaceLandmarkPoint[], i: number, mirrored: boolean) {
  const p = landmarks[i];
  if (!p) return null;
  return { x: mirrored ? 1 - p.x : p.x, y: p.y };
}

export function enrichFaceBox(
  landmarks: FaceLandmarkPoint[],
  mirrored = false,
): FaceBox {
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

  const right = pt(landmarks, LM.rightEye, mirrored);
  const left = pt(landmarks, LM.leftEye, mirrored);
  let rotation = 0;
  let eyes: FaceBox['eyes'];
  if (right && left) {
    rotation = (Math.atan2(left.y - right.y, left.x - right.x) * 180) / Math.PI;
    const dx = left.x - right.x;
    const dy = left.y - right.y;
    const dist = Math.hypot(dx, dy);
    eyes = {
      cx: (left.x + right.x) / 2,
      cy: (left.y + right.y) / 2,
      width: Math.max(0.18, dist * 2.55),
    };
  }

  const forehead = pt(landmarks, LM.forehead, mirrored);
  const chin = pt(landmarks, LM.chin, mirrored);
  const nose = pt(landmarks, LM.nose, mirrored);
  const mouthU = pt(landmarks, LM.mouthUpper, mirrored);
  const mouthL = pt(landmarks, LM.mouthLower, mirrored);

  const width = Math.max(0.16, maxX - minX);
  const height = Math.max(0.18, maxY - minY);

  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width,
    height,
    rotation,
    landmarks,
    eyes,
    forehead: forehead
      ? { cx: forehead.x, cy: forehead.y - height * 0.08 }
      : { cx: (minX + maxX) / 2, cy: minY + height * 0.06 },
    mouth:
      mouthU && mouthL
        ? { cx: (mouthU.x + mouthL.x) / 2, cy: (mouthU.y + mouthL.y) / 2 }
        : chin
          ? { cx: chin.x, cy: chin.y - height * 0.18 }
          : undefined,
    nose: nose ? { cx: nose.x, cy: nose.y } : undefined,
  };
}

export function heuristicFaceBox(): FaceBox {
  return withHeuristicAnchors({ ...DEFAULT_FACE_BOX });
}

export function withHeuristicAnchors(box: FaceBox): FaceBox {
  return {
    ...box,
    eyes: box.eyes ?? {
      cx: box.cx,
      cy: box.cy - box.height * 0.1,
      width: box.width * 1.05,
    },
    forehead: box.forehead ?? {
      cx: box.cx,
      cy: box.cy - box.height * 0.48,
    },
    mouth: box.mouth ?? {
      cx: box.cx,
      cy: box.cy + box.height * 0.22,
    },
    nose: box.nose ?? {
      cx: box.cx,
      cy: box.cy + box.height * 0.02,
    },
  };
}

export function smoothBox(prev: FaceBox | null, next: FaceBox, t = 0.42): FaceBox {
  if (!prev) return next;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const lerpPt = (
    a: { cx: number; cy: number; width?: number } | undefined,
    b: { cx: number; cy: number; width?: number } | undefined,
  ) => {
    if (!a && !b) return undefined;
    if (!a) return b;
    if (!b) return a;
    return {
      cx: lerp(a.cx, b.cx),
      cy: lerp(a.cy, b.cy),
      ...(a.width != null || b.width != null
        ? { width: lerp(a.width ?? b.width ?? 0.2, b.width ?? a.width ?? 0.2) }
        : {}),
    };
  };
  let d = next.rotation - prev.rotation;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return {
    cx: lerp(prev.cx, next.cx),
    cy: lerp(prev.cy, next.cy),
    width: lerp(prev.width, next.width),
    height: lerp(prev.height, next.height),
    rotation: prev.rotation + d * t,
    landmarks: next.landmarks,
    eyes: lerpPt(prev.eyes, next.eyes) as FaceBox['eyes'],
    forehead: lerpPt(prev.forehead, next.forehead),
    mouth: lerpPt(prev.mouth, next.mouth),
    nose: lerpPt(prev.nose, next.nose),
  };
}

export type FilterLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  fontSize: number;
};

export function layoutFilter(
  box: FaceBox,
  filter: FaceFilterDef,
  viewW: number,
  viewH: number,
): FilterLayout {
  const b = withHeuristicAnchors(box);
  const anchor = filter.anchor ?? 'face';
  const extraY = (filter.yOffset ?? 0) * b.height;
  const scale = filter.scale || 1;
  const faceWpx = b.width * viewW;
  const faceHpx = b.height * viewH;

  let nx = b.cx;
  let ny = b.cy;
  let w = faceWpx * scale;
  let h = faceHpx * scale;

  if (anchor === 'eyes' && b.eyes) {
    nx = b.eyes.cx;
    ny = b.eyes.cy + extraY;
    w = (b.eyes.width || b.width) * viewW * scale;
    h = w * 0.48;
  } else if (anchor === 'forehead' && b.forehead) {
    nx = b.forehead.cx;
    ny = b.forehead.cy + extraY;
    w = faceWpx * 0.82 * scale;
    h = w * 0.58;
  } else if (anchor === 'mouth' && b.mouth) {
    nx = b.mouth.cx;
    ny = b.mouth.cy + extraY;
    w = faceWpx * 0.78 * scale;
    h = w * 0.62;
  } else if (anchor === 'nose' && b.nose) {
    nx = b.nose.cx;
    ny = b.nose.cy + extraY;
    w = faceWpx * 0.5 * scale;
    h = w * 0.72;
  } else {
    ny = b.cy + extraY;
    w = faceWpx * 1.06 * scale;
    h = faceHpx * 1.04 * scale;
  }

  return {
    x: nx * viewW,
    y: ny * viewH,
    w,
    h,
    rotation: b.rotation,
    fontSize: Math.max(18, Math.min(w, h) * (anchor === 'eyes' ? 1.08 : 0.9)),
  };
}
