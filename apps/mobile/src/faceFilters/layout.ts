import type { FaceBox, FaceFilterDef, FaceLandmarkPoint, FilterLayer } from './types';

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
  cy: 0.4,
  width: 0.54,
  height: 0.66,
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
      width: Math.max(0.22, dist * 2.7),
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
  const box = { ...DEFAULT_FACE_BOX };
  return withHeuristicAnchors(box);
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
  // shortest-path rotation lerp
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

/** Pixel layout for a Snapchat-style sticker / privacy mask. */
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
    h = w * 0.55;
  } else if (anchor === 'forehead' && b.forehead) {
    nx = b.forehead.cx;
    ny = b.forehead.cy + extraY;
    w = faceWpx * 1.05 * scale;
    h = w * 0.72;
  } else if (anchor === 'mouth' && b.mouth) {
    nx = b.mouth.cx;
    ny = b.mouth.cy + extraY;
    w = faceWpx * 0.92 * scale;
    h = w * 0.7;
  } else if (anchor === 'nose' && b.nose) {
    nx = b.nose.cx;
    ny = b.nose.cy + extraY;
    w = faceWpx * 0.42 * scale;
    h = w;
  } else {
    ny = b.cy + extraY;
    w = faceWpx * 1.12 * scale;
    h = faceHpx * 1.1 * scale;
  }

  return {
    x: nx * viewW,
    y: ny * viewH,
    w,
    h,
    rotation: filter.rotationEnabled === false ? 0 : b.rotation,
    fontSize: Math.max(36, (anchor === 'eyes' ? w : Math.min(w, h)) * 0.92),
  };
}

export type PlacedLayer = FilterLayout & { kind: FilterLayer['kind'] };

/** Place every catalog layer on the current face box. */
export function layoutFilterLayers(
  box: FaceBox,
  filter: FaceFilterDef,
  viewW: number,
  viewH: number,
): PlacedLayer[] {
  const layers = filter.layers;
  if (!layers?.length) {
    return [{ ...layoutFilter(box, filter, viewW, viewH), kind: 'sunglasses' }];
  }
  return layers.map((layer) => {
    const synthetic: FaceFilterDef = {
      ...filter,
      anchor: layer.anchor,
      scale: layer.scale ?? filter.scale,
      yOffset: layer.yOffset ?? filter.yOffset,
    };
    return { ...layoutFilter(box, synthetic, viewW, viewH), kind: layer.kind };
  });
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

/** Compact LiveKit attribute payload. */
export function serializeFaceBox(box: FaceBox): string {
  return JSON.stringify({
    cx: round4(box.cx),
    cy: round4(box.cy),
    w: round4(box.width),
    h: round4(box.height),
    r: round4(box.rotation),
    e: box.eyes
      ? [round4(box.eyes.cx), round4(box.eyes.cy), round4(box.eyes.width)]
      : undefined,
    f: box.forehead ? [round4(box.forehead.cx), round4(box.forehead.cy)] : undefined,
    m: box.mouth ? [round4(box.mouth.cx), round4(box.mouth.cy)] : undefined,
    n: box.nose ? [round4(box.nose.cx), round4(box.nose.cy)] : undefined,
  });
}

export function parseFaceBox(raw: string | null | undefined): FaceBox | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as {
      cx?: number;
      cy?: number;
      w?: number;
      h?: number;
      r?: number;
      e?: number[];
      f?: number[];
      m?: number[];
      n?: number[];
    };
    if (typeof p.cx !== 'number' || typeof p.cy !== 'number') return null;
    return withHeuristicAnchors({
      cx: p.cx,
      cy: p.cy,
      width: typeof p.w === 'number' ? p.w : 0.45,
      height: typeof p.h === 'number' ? p.h : 0.58,
      rotation: typeof p.r === 'number' ? p.r : 0,
      eyes: p.e?.length === 3 ? { cx: p.e[0], cy: p.e[1], width: p.e[2] } : undefined,
      forehead: p.f?.length === 2 ? { cx: p.f[0], cy: p.f[1] } : undefined,
      mouth: p.m?.length === 2 ? { cx: p.m[0], cy: p.m[1] } : undefined,
      nose: p.n?.length === 2 ? { cx: p.n[0], cy: p.n[1] } : undefined,
    });
  } catch {
    return null;
  }
}
