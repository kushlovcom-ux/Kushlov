import type { FilterAnchor, FilterSprite, SpriteId } from '@kushlov/filter-core';

/**
 * Compatibility layer for the mobile client's filter wire format.
 *
 * Mobile publishes its selected filter id plus a compact face box as LiveKit
 * participant attributes, and only bakes the effect into its own pixels when
 * the native GPU path is available. When it is not, web has to draw the
 * accessory on the remote tile — so these ids and this box encoding are wire
 * format and must keep matching `apps/mobile/src/faceFilters`.
 */

export type RemoteFaceBox = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** Degrees, as mobile serialises it. */
  rotation: number;
  eyes?: { cx: number; cy: number; width: number };
  anchors: Record<FilterAnchor, { x: number; y: number }>;
};

/** Mobile filters that are pure privacy masks rather than accessories. */
export const MOBILE_PRIVACY_FILTERS = new Set(['pixelFace', 'mosaicFace', 'blurFace']);

/** Mobile filter id → accessory sprites, mirroring the mobile catalog. */
export const MOBILE_FILTER_SPRITES: Record<string, FilterSprite[]> = {
  blackSunglasses: [{ sprite: 'sunglasses', anchor: 'eyes', scale: 1.28 }],
  aviatorSunglasses: [{ sprite: 'aviator', anchor: 'eyes', scale: 1.32 }],
  heartGlasses: [{ sprite: 'heartGlasses', anchor: 'eyes', scale: 1.28 }],
  rainbowGlasses: [{ sprite: 'rainbowGlasses', anchor: 'eyes', scale: 1.26, yOffset: -0.02 }],
  animeEyes: [{ sprite: 'animeEyes', anchor: 'eyes', scale: 1.18 }],
  laserEyes: [{ sprite: 'laserEyes', anchor: 'eyes', scale: 1.2 }],
  medicalMask: [{ sprite: 'medicalMask', anchor: 'mouth', scale: 1.35 }],
  anonymousMask: [{ sprite: 'anonMask', anchor: 'face', scale: 1.18 }],
  fakeMustache: [{ sprite: 'mustache', anchor: 'mouth', scale: 1.22, yOffset: -0.04 }],
  clownNose: [{ sprite: 'clownNose', anchor: 'nose', scale: 0.95 }],
  robotFace: [
    { sprite: 'robotVisor', anchor: 'eyes', scale: 1.2 },
    { sprite: 'robotJaw', anchor: 'mouth', scale: 1.05 },
  ],
  catFace: [
    { sprite: 'catEars', anchor: 'forehead', scale: 1.28, yOffset: -0.06 },
    { sprite: 'catNose', anchor: 'nose', scale: 0.85 },
    { sprite: 'catWhiskers', anchor: 'mouth', scale: 1.15, yOffset: -0.08 },
  ],
  dogFace: [
    { sprite: 'dogEars', anchor: 'forehead', scale: 1.32, yOffset: -0.04 },
    { sprite: 'dogNose', anchor: 'nose', scale: 0.92 },
  ],
  bunnyEars: [{ sprite: 'bunnyEars', anchor: 'forehead', scale: 1.35, yOffset: -0.08 }],
  crown: [{ sprite: 'crown', anchor: 'forehead', scale: 1.38, yOffset: -0.1 }],
  flowerCrown: [{ sprite: 'flowerCrown', anchor: 'forehead', scale: 1.4, yOffset: -0.08 }],
  devilHorns: [{ sprite: 'devilHorns', anchor: 'forehead', scale: 1.32, yOffset: -0.1 }],
};

export function remoteFilterSprites(id: string | null | undefined): FilterSprite[] | null {
  if (!id) return null;
  return MOBILE_FILTER_SPRITES[id] ?? null;
}

export function isRemotePrivacyFilter(id: string | null | undefined): boolean {
  return Boolean(id) && MOBILE_PRIVACY_FILTERS.has(id as string);
}

export type ObjectFit = 'contain' | 'cover' | 'fill';

export type ContentRect = { x: number; y: number; w: number; h: number };

/**
 * Pixel box of the video image inside a tile after object-fit. Face boxes from
 * mobile are in video-frame space — mapping them to the full tile (including
 * letterbox) paints glasses over the local PiP on web calls.
 */
export function objectFitContentRect(
  containerW: number,
  containerH: number,
  mediaW: number,
  mediaH: number,
  fit: ObjectFit = 'contain',
): ContentRect {
  if (containerW < 1 || containerH < 1 || mediaW < 1 || mediaH < 1 || fit === 'fill') {
    return { x: 0, y: 0, w: containerW, h: containerH };
  }
  const mediaAspect = mediaW / mediaH;
  const boxAspect = containerW / containerH;
  const mediaIsWider = mediaAspect > boxAspect;
  if (fit === 'contain' ? mediaIsWider : !mediaIsWider) {
    const w = containerW;
    const h = w / mediaAspect;
    return { x: 0, y: (containerH - h) / 2, w, h };
  }
  const h = containerH;
  const w = h * mediaAspect;
  return { x: (containerW - w) / 2, y: 0, w, h };
}

function derivedAnchors(
  cx: number,
  cy: number,
  height: number,
  partial: Partial<Record<FilterAnchor, { x: number; y: number }>>,
): Record<FilterAnchor, { x: number; y: number }> {
  return {
    face: partial.face ?? { x: cx, y: cy },
    eyes: partial.eyes ?? { x: cx, y: cy - height * 0.1 },
    forehead: partial.forehead ?? { x: cx, y: cy - height * 0.48 },
    mouth: partial.mouth ?? { x: cx, y: cy + height * 0.22 },
    nose: partial.nose ?? { x: cx, y: cy + height * 0.02 },
  };
}

/** Parses mobile's compact box payload. Returns null until a real box arrives. */
export function parseRemoteFaceBox(raw: string | null | undefined): RemoteFaceBox | null {
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

    const cx = p.cx;
    const cy = p.cy;
    const width = typeof p.w === 'number' ? p.w : 0.45;
    const height = typeof p.h === 'number' ? p.h : 0.58;
    const eyes =
      p.e?.length === 3 ? { cx: p.e[0]!, cy: p.e[1]!, width: p.e[2]! } : undefined;

    return {
      cx,
      cy,
      width,
      height,
      rotation: typeof p.r === 'number' ? p.r : 0,
      eyes,
      anchors: derivedAnchors(cx, cy, height, {
        eyes: eyes ? { x: eyes.cx, y: eyes.cy } : undefined,
        forehead: p.f?.length === 2 ? { x: p.f[0]!, y: p.f[1]! } : undefined,
        mouth: p.m?.length === 2 ? { x: p.m[0]!, y: p.m[1]! } : undefined,
        nose: p.n?.length === 2 ? { x: p.n[0]!, y: p.n[1]! } : undefined,
      }),
    };
  } catch {
    return null;
  }
}

export type RemoteSpriteLayout = {
  sprite: SpriteId;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Radians. */
  rotation: number;
};

/**
 * Same anchor geometry as the WebGL renderer, in tile pixels. Keeping the two
 * in sync is what makes a mobile user's crown sit in the same place whether it
 * arrives baked or as an overlay.
 */
export function layoutRemoteSprites(
  box: RemoteFaceBox,
  sprites: FilterSprite[],
  viewW: number,
  viewH: number,
): RemoteSpriteLayout[] {
  const faceW = box.width * viewW;
  const faceH = box.height * viewH;
  const rotation = (box.rotation * Math.PI) / 180;

  return sprites.map((item) => {
    const point = box.anchors[item.anchor] ?? box.anchors.face;
    const offsetPx = (item.yOffset ?? 0) * box.height * viewH;
    let w: number;
    let h: number;

    switch (item.anchor) {
      case 'eyes':
        w = Math.max(0.22, box.eyes?.width ?? box.width) * viewW * item.scale;
        h = w * 0.55;
        break;
      case 'forehead':
        w = faceW * 1.05 * item.scale;
        h = w * 0.72;
        break;
      case 'mouth':
        w = faceW * 0.92 * item.scale;
        h = w * 0.7;
        break;
      case 'nose':
        w = faceW * 0.42 * item.scale;
        h = w;
        break;
      default:
        w = faceW * 1.12 * item.scale;
        h = faceH * 1.1 * item.scale;
    }

    return {
      sprite: item.sprite,
      x: point.x * viewW,
      y: point.y * viewH + offsetPx,
      w,
      h,
      rotation,
    };
  });
}
