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

export type FaceBox = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
  landmarks?: FaceLandmarkPoint[];
};

export type FaceFilterDef = {
  id: FaceFilterId;
  name: string;
  category: FaceFilterCategory;
  emoji: string;
  /** Relative size vs face width */
  scale: number;
  /** Vertical offset as fraction of face height (negative = up) */
  yOffset?: number;
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
