import type { FaceFilterCategory, FaceFilterDef, FaceFilterId } from './types';

export const FILTER_CATEGORIES: { id: FaceFilterCategory; label: string }[] = [
  { id: 'privacy', label: 'Privacy' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'funny', label: 'Funny' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'animals', label: 'Animals' },
  { id: 'masks', label: 'Masks' },
  { id: 'trending', label: 'Trending' },
];

export const FACE_FILTER_CATALOG: FaceFilterDef[] = [
  { id: 'none', name: 'Off', category: 'trending', emoji: '✕', scale: 1 },
  { id: 'blackSunglasses', name: 'Black Sunglasses', category: 'glasses', emoji: '🕶️', scale: 1.15, yOffset: -0.08 },
  { id: 'aviatorSunglasses', name: 'Aviator Sunglasses', category: 'glasses', emoji: '😎', scale: 1.2, yOffset: -0.05 },
  { id: 'heartGlasses', name: 'Heart Glasses', category: 'glasses', emoji: '😍', scale: 1.25, yOffset: -0.05 },
  { id: 'rainbowGlasses', name: 'Rainbow Glasses', category: 'glasses', emoji: '🌈', scale: 1.1, yOffset: -0.12 },
  { id: 'medicalMask', name: 'Medical Mask', category: 'masks', emoji: '😷', scale: 1.35 },
  { id: 'anonymousMask', name: 'Anonymous Mask', category: 'privacy', emoji: '🎭', scale: 1.4, privacy: 'solid' },
  { id: 'pixelFace', name: 'Pixel Face', category: 'privacy', emoji: '🟦', scale: 1.35, privacy: 'pixel' },
  { id: 'mosaicFace', name: 'Mosaic Face', category: 'privacy', emoji: '🧩', scale: 1.35, privacy: 'mosaic' },
  { id: 'blurFace', name: 'Blur Face', category: 'privacy', emoji: '🌫️', scale: 1.35, privacy: 'blur' },
  { id: 'fakeMustache', name: 'Fake Mustache', category: 'funny', emoji: '🥸', scale: 1.15, yOffset: 0.12 },
  { id: 'robotFace', name: 'Robot Face', category: 'masks', emoji: '🤖', scale: 1.4 },
  { id: 'catFace', name: 'Cat Face', category: 'animals', emoji: '🐱', scale: 1.45 },
  { id: 'dogFace', name: 'Dog Face', category: 'animals', emoji: '🐶', scale: 1.45 },
  { id: 'bunnyEars', name: 'Bunny Ears', category: 'animals', emoji: '🐰', scale: 1.2, yOffset: -0.55 },
  { id: 'crown', name: 'Crown', category: 'trending', emoji: '👑', scale: 1.1, yOffset: -0.55 },
  { id: 'smoothSkin', name: 'Smooth Skin', category: 'beauty', emoji: '✨', scale: 1, beauty: true },
  { id: 'beauty', name: 'Beauty Filter', category: 'beauty', emoji: '💄', scale: 1, beauty: true },
];

export function getFilterDef(id: FaceFilterId | string | null | undefined): FaceFilterDef | null {
  if (!id || id === 'none') return null;
  return FACE_FILTER_CATALOG.find((f) => f.id === id) ?? null;
}

export function filtersByCategory(category: FaceFilterCategory): FaceFilterDef[] {
  return FACE_FILTER_CATALOG.filter((f) => f.category === category || f.id === 'none');
}
