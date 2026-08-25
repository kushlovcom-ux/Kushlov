/** Shared face-filter types for Kushlov AR pipeline. */

export type FaceFilterCategory =
  | 'privacy'
  | 'glasses'
  | 'funny'
  | 'beauty'
  | 'animals'
  | 'masks'
  | 'trending'
  | 'backgrounds';

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
  | 'beauty'
  | 'laserEyes'
  | 'animeEyes'
  | 'clownNose'
  | 'flowerCrown'
  | 'devilHorns'
  | 'bgBlur'
  | 'bgDim'
  | 'bgSunset'
  | 'bgNight'
  | 'bgStudio'
  | 'bgNeon';

export type FaceLandmarkPoint = { x: number; y: number; z?: number };

export type FilterAnchor = 'face' | 'eyes' | 'forehead' | 'mouth' | 'nose';

export type FilterLayerKind =
  | 'sunglasses'
  | 'aviator'
  | 'heartGlasses'
  | 'rainbowGlasses'
  | 'animeEyes'
  | 'laserEyes'
  | 'medicalMask'
  | 'mustache'
  | 'dogEars'
  | 'dogNose'
  | 'catEars'
  | 'catNose'
  | 'catWhiskers'
  | 'bunnyEars'
  | 'crown'
  | 'flowerCrown'
  | 'devilHorns'
  | 'clownNose'
  | 'robotVisor'
  | 'robotJaw'
  | 'anonMask';

export type FilterLayer = {
  kind: FilterLayerKind;
  anchor: FilterAnchor;
  scale?: number;
  yOffset?: number;
};

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
  rotationEnabled?: boolean;
  privacy?: 'pixel' | 'mosaic' | 'blur' | 'solid';
  beauty?: boolean;
  background?: 'blur' | 'dim' | 'sunset' | 'night' | 'studio' | 'neon';
  layers?: FilterLayer[];
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
export const FACE_FILTER_BOX_ATTR = 'kushlovFaceBox';
export const FACE_FILTER_TOPIC = 'kushlov.ff';
