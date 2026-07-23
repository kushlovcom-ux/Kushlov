/**
 * Face-only video call masks (emoji / icon overlays).
 * Synced across clients via LiveKit participant attribute `kushlovFaceMask`.
 */

export const FACE_MASK_ATTR = 'kushlovFaceMask';

export type FaceMaskId =
  | 'none'
  | 'mask'
  | 'theater'
  | 'cat'
  | 'dog'
  | 'fox'
  | 'alien'
  | 'robot'
  | 'ghost'
  | 'clown'
  | 'sunglasses'
  | 'hearts'
  | 'flower'
  | 'crown';

export type FaceMaskDef = {
  id: FaceMaskId;
  label: string;
  /** Display glyph covering the face region */
  emoji: string;
  /** How large relative to detected face width (1 = face width) */
  scale: number;
};

export const FACE_MASKS: FaceMaskDef[] = [
  { id: 'none', label: 'Off', emoji: '', scale: 1 },
  { id: 'mask', label: 'Mask', emoji: '😷', scale: 1.35 },
  { id: 'theater', label: 'Theater', emoji: '🎭', scale: 1.4 },
  { id: 'cat', label: 'Cat', emoji: '🐱', scale: 1.45 },
  { id: 'dog', label: 'Dog', emoji: '🐶', scale: 1.45 },
  { id: 'fox', label: 'Fox', emoji: '🦊', scale: 1.4 },
  { id: 'alien', label: 'Alien', emoji: '👽', scale: 1.4 },
  { id: 'robot', label: 'Robot', emoji: '🤖', scale: 1.4 },
  { id: 'ghost', label: 'Ghost', emoji: '👻', scale: 1.45 },
  { id: 'clown', label: 'Clown', emoji: '🤡', scale: 1.4 },
  { id: 'sunglasses', label: 'Shades', emoji: '🕶️', scale: 1.15 },
  { id: 'hearts', label: 'Hearts', emoji: '😍', scale: 1.4 },
  { id: 'flower', label: 'Flower', emoji: '🌸', scale: 1.25 },
  { id: 'crown', label: 'Crown', emoji: '👑', scale: 1.1 },
];

export function getFaceMask(id: string | null | undefined): FaceMaskDef | null {
  if (!id || id === 'none') return null;
  return FACE_MASKS.find((m) => m.id === id) ?? null;
}

export function isFaceMaskId(value: string | null | undefined): value is FaceMaskId {
  return !!value && FACE_MASKS.some((m) => m.id === value);
}
