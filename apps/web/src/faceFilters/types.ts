/** Shared face-filter types for Kushlov AR pipeline. */

export type FaceFilterCategory =
  | 'privacy'
  | 'glasses'
  | 'funny'
  | 'beauty'
  | 'animals'
  | 'masks'
  | 'trending';

export type FaceFilterId =
  | 'none'
  | 'blackSunglasses'
  | 'aviatorSunglasses'
  | 'medicalMask'
  | 'pixelFace'
  | 'mosaicFace'
  | 'blurFace'
  | 'anonymousMask'
  | 'fakeMustache'
  | 'robotFace'
  | 'catFace'
  | 'dogFace'
  | 'bunnyEars'
  | 'crown'
  | 'heartGlasses'
  | 'rainbowGlasses'
  | 'smoothSkin'
  | 'beauty';

export type FaceLandmarkPoint = { x: number; y: number; z?: number };

export type FilterAnchor = 'face' | 'eyes' | 'forehead' | 'mouth' | 'nose';

export type FaceBox = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
  landmarks?: FaceLandmarkPoint[];
  eyes?: { cx: number; cy: number; width: number };
  forehead?: { cx: number; cy: number };
  mouth?: { cx: number; cy: number };
  nose?: { cx: number; cy: number };
};

export type FaceFilterDef = {
  id: FaceFilterId;
  name: string;
  category: FaceFilterCategory;
  emoji: string;
  /** Relative size vs the anchored region */
  scale: number;
  /** Extra vertical nudge as a fraction of face height (negative = up) */
  yOffset?: number;
  /** Where the sticker locks — Snapchat-style */
  anchor?: FilterAnchor;
  privacy?: 'pixel' | 'mosaic' | 'blur' | 'solid';
  beauty?: boolean;
};

export type FaceFilterSettings = {
  enabled: boolean;
  lastFilterId: FaceFilterId;
  favorites: FaceFilterId[];
  beautyDefault: boolean;
  disableOnLowBattery: boolean;
};

/** LiveKit attribute key — used when clients sync filter selection without bitstream replace. */
export const FACE_FILTER_ATTR = 'kushlovFaceFilter';
