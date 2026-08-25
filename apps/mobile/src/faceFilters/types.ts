/** Shared face-filter types for Kushlov AR pipeline (mobile). */

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
  | 'bgBlur'
  | 'bgDim'
  | 'bgSunset'
  | 'bgNight'
  | 'bgStudio'
  | 'bgNeon';

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
  scale: number;
  yOffset?: number;
  anchor?: FilterAnchor;
  privacy?: 'pixel' | 'mosaic' | 'blur' | 'solid';
  beauty?: boolean;
  /** Full-frame scene grade / virtual-background wash. */
  background?: 'blur' | 'dim' | 'sunset' | 'night' | 'studio' | 'neon';
};

export type FaceFilterSettings = {
  enabled: boolean;
  lastFilterId: FaceFilterId;
  favorites: FaceFilterId[];
  beautyDefault: boolean;
  disableOnLowBattery: boolean;
};

/** LiveKit attribute key — remotes can overlay when bitstream processing is unavailable. */
export const FACE_FILTER_ATTR = 'kushlovFaceFilter';
