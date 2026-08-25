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
  scale: number;
  yOffset?: number;
  anchor?: FilterAnchor;
  rotationEnabled?: boolean;
  privacy?: 'pixel' | 'mosaic' | 'blur' | 'solid';
  beauty?: boolean;
  background?: 'blur' | 'dim' | 'sunset' | 'night' | 'studio' | 'neon';
  /** Landmark-locked vector parts. New filters only need entries here. */
  layers?: FilterLayer[];
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
/** Compact serialized FaceBox so remotes can lock overlays to the publisher's landmarks. */
export const FACE_FILTER_BOX_ATTR = 'kushlovFaceBox';
/** Reliable data-channel topic — attributes can miss on some native clients. */
export const FACE_FILTER_TOPIC = 'kushlov.ff';
