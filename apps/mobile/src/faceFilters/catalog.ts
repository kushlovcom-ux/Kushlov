import type { FaceFilterCategory, FaceFilterDef, FaceFilterId } from './types';

export const FILTER_CATEGORIES: { id: FaceFilterCategory; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'backgrounds', label: 'Background' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'funny', label: 'Funny' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'animals', label: 'Animals' },
  { id: 'masks', label: 'Masks' },
];

export const FACE_FILTER_CATALOG: FaceFilterDef[] = [
  { id: 'none', name: 'Off', category: 'trending', emoji: '✕', scale: 1 },
  { id: 'blackSunglasses', name: 'Black Sunglasses', category: 'glasses', emoji: '🕶️', scale: 1.05, anchor: 'eyes' },
  { id: 'aviatorSunglasses', name: 'Aviator Sunglasses', category: 'glasses', emoji: '😎', scale: 1.08, anchor: 'eyes' },
  { id: 'heartGlasses', name: 'Heart Glasses', category: 'glasses', emoji: '😍', scale: 1.12, anchor: 'eyes' },
  { id: 'rainbowGlasses', name: 'Rainbow Glasses', category: 'glasses', emoji: '🌈', scale: 1.05, yOffset: -0.06, anchor: 'eyes' },
  { id: 'medicalMask', name: 'Medical Mask', category: 'masks', emoji: '😷', scale: 1.15, anchor: 'mouth' },
  { id: 'anonymousMask', name: 'Anonymous Mask', category: 'privacy', emoji: '🎭', scale: 1.12, privacy: 'solid', anchor: 'face' },
  { id: 'pixelFace', name: 'Pixel Face', category: 'privacy', emoji: '🟦', scale: 1.1, privacy: 'pixel', anchor: 'face' },
  { id: 'mosaicFace', name: 'Mosaic Face', category: 'privacy', emoji: '🧩', scale: 1.1, privacy: 'mosaic', anchor: 'face' },
  { id: 'blurFace', name: 'Blur Face', category: 'privacy', emoji: '🌫️', scale: 1.1, privacy: 'blur', anchor: 'face' },
  { id: 'fakeMustache', name: 'Fake Mustache', category: 'funny', emoji: '🥸', scale: 1.05, anchor: 'mouth' },
  { id: 'robotFace', name: 'Robot Face', category: 'masks', emoji: '🤖', scale: 1.12, anchor: 'face' },
  { id: 'catFace', name: 'Cat Face', category: 'animals', emoji: '🐱', scale: 1.15, anchor: 'face' },
  { id: 'dogFace', name: 'Dog Face', category: 'animals', emoji: '🐶', scale: 1.15, anchor: 'face' },
  { id: 'bunnyEars', name: 'Bunny Ears', category: 'animals', emoji: '🐰', scale: 1.15, yOffset: -0.04, anchor: 'forehead' },
  { id: 'crown', name: 'Crown', category: 'trending', emoji: '👑', scale: 1.2, yOffset: -0.06, anchor: 'forehead' },
  { id: 'smoothSkin', name: 'Smooth Skin', category: 'beauty', emoji: '✨', scale: 1, beauty: true, anchor: 'face' },
  { id: 'beauty', name: 'Beauty Filter', category: 'beauty', emoji: '💄', scale: 1, beauty: true, anchor: 'face' },
  { id: 'bgBlur', name: 'Blur room', category: 'backgrounds', emoji: '🌁', scale: 1, background: 'blur' },
  { id: 'bgDim', name: 'Dim studio', category: 'backgrounds', emoji: '🌑', scale: 1, background: 'dim' },
  { id: 'bgSunset', name: 'Sunset', category: 'backgrounds', emoji: '🌇', scale: 1, background: 'sunset' },
  { id: 'bgNight', name: 'Night city', category: 'backgrounds', emoji: '🌃', scale: 1, background: 'night' },
  { id: 'bgStudio', name: 'Soft studio', category: 'backgrounds', emoji: '💡', scale: 1, background: 'studio' },
  { id: 'bgNeon', name: 'Neon club', category: 'backgrounds', emoji: '💜', scale: 1, background: 'neon' },
];

export function getFilterDef(id: FaceFilterId | string | null | undefined): FaceFilterDef | null {
  if (!id || id === 'none') return null;
  return FACE_FILTER_CATALOG.find((f) => f.id === id) ?? null;
}

export function filtersByCategory(category: FaceFilterCategory): FaceFilterDef[] {
  return FACE_FILTER_CATALOG.filter((f) => f.category === category || f.id === 'none');
}
