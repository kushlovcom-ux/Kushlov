/**
 * Platform-agnostic filter vocabulary shared by the web (WebGL2) and mobile
 * (native GPU) engines. Nothing here may reference DOM, WebGL, or React
 * Native — only the data both renderers agree on.
 */

export type FilterPlatform = 'web' | 'android' | 'ios';

export type FilterCategory =
  | 'none'
  | 'beauty'
  | 'color'
  | 'glasses'
  | 'animals'
  | 'accessories'
  | 'fun'
  | 'masks'
  | 'makeup'
  | 'effects';

/** What a renderer actually has to do. Drives which pipeline stages run. */
export type FilterKind = 'none' | 'beauty' | 'colorGrade' | 'faceAccessory';

/** Landmark group a sprite locks onto. */
export type FilterAnchor = 'face' | 'eyes' | 'forehead' | 'mouth' | 'nose';

/**
 * Sprites are rasterised once per engine from vector drawing code, then
 * composited on the GPU. Adding an id requires a matching painter in the
 * platform sprite factory, which is what keeps the set honest.
 */
export type SpriteId =
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

export type SpriteBlend = 'normal' | 'multiply' | 'screen';

export type FilterSprite = {
  sprite: SpriteId;
  anchor: FilterAnchor;
  /** Size relative to the anchor region. */
  scale: number;
  /** Vertical nudge as a fraction of face height; negative moves up. */
  yOffset?: number;
  blend?: SpriteBlend;
  opacity?: number;
};

export type ColorGrade = 'warm' | 'cool' | 'vintage' | 'cinematic' | 'mono';

/** Only controls that are actually implemented by a shader belong here. */
export type BeautySettings = {
  /** Edge-preserving skin blur strength. */
  skinSmoothing: number;
  /** Exposure lift. */
  brightness: number;
  /** Skin tone temperature; 0.5 is neutral. */
  warmth: number;
};

export type FilterDefinition = {
  id: string;
  name: string;
  category: FilterCategory;
  /** Lightweight list thumbnail — never spins up an engine per row. */
  thumbnail: string;
  kind: FilterKind;
  sprites?: FilterSprite[];
  colorGrade?: ColorGrade;
  /** Beauty preset applied on selection, merged over the user's settings. */
  beauty?: Partial<BeautySettings>;
  supportedPlatforms: FilterPlatform[];
};

export type FaceLandmark = { x: number; y: number; z: number };

export type FaceAnchorPoint = { x: number; y: number };

/**
 * One frame of tracking, normalised to 0..1 in the source image space so the
 * same numbers drive a WebGL quad and a native GPU quad identically.
 */
export type FaceTrackingData = {
  detected: boolean;
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** Head roll in radians, from the eye line. */
  roll: number;
  /** Eye separation — the most stable scale reference across distances. */
  eyeDistance: number;
  anchors: Record<FilterAnchor, FaceAnchorPoint>;
  landmarks?: FaceLandmark[];
  /** MediaPipe blendshape scores, when the model emits them. */
  blendshapes?: Record<string, number>;
};

export type PlatformCapabilities = {
  faceTracking: boolean;
  gpuRendering: boolean;
  maxFaces: number;
};

export type FilterEngineStatus = 'idle' | 'initializing' | 'running' | 'paused' | 'failed';

/**
 * The contract both platform engines implement. UI talks to this and never to
 * MediaPipe, WebGL, or the camera directly.
 */
export interface FilterEngine {
  readonly status: FilterEngineStatus;
  readonly capabilities: PlatformCapabilities;
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  loadFilter(id: string): void;
  removeFilter(): void;
  setBeauty(settings: Partial<BeautySettings>): void;
  destroy(): void;
}
