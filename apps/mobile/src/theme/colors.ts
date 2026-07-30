/**
 * Kushlov Design System — Color tokens
 * Extracted from the official “K” wordmark (klproind.com / kush.png):
 * Magenta → Purple → Cyan → Orange metallic gradients.
 */

export const brand = {
  /** Primary CTA / hearts / active states — logo magenta */
  pink: '#EC4899',
  pinkLight: '#F472B6',
  pinkDark: '#DB2777',
  /** Secondary — logo electric violet */
  purple: '#8B5CF6',
  purpleLight: '#A78BFA',
  purpleDark: '#7C3AED',
  /** Accent cyan from logo stem highlight */
  cyan: '#22D3EE',
  cyanDark: '#06B6D4',
  /** Accent coral/orange from logo arm tips */
  orange: '#F97316',
  orangeLight: '#FB923C',
  /** Deep indigo used in logo shadows */
  indigo: '#2E004F',
  midnight: '#0A0B1E',
} as const;

/** Signature 3-stop brand gradient (blue → magenta → orange) */
export const brandGradient = [brand.cyan, brand.pink, brand.orange] as const;
/** Soft CTA gradient (magenta → purple) */
export const actionGradient = [brand.pink, brand.purple] as const;
/** VIP / premium gold feel */
export const vipGradient = ['#F59E0B', '#FBBF24', '#F97316'] as const;
/** Night sky mesh for backgrounds */
export const nightGradient = ['#12081A', '#050510', '#0A0618'] as const;

export const darkColors = {
  // Surfaces — rich black, not pure #000
  bg: '#050510',
  bgElevated: '#0C0C16',
  card: '#12121C',
  elevated: '#1A1A28',
  surfaceGlass: 'rgba(255,255,255,0.06)',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  divider: 'rgba(255,255,255,0.06)',

  text: '#FAFAFA',
  textSecondary: '#A1A1B5',
  textMuted: '#6B6B80',
  textInverse: '#050510',

  // Semantic
  danger: '#F43F5E',
  success: '#34D399',
  warning: '#FBBF24',
  info: brand.cyan,

  online: '#34D399',
  offline: '#6B6B80',

  premiumGold: '#FBBF24',
  vip: '#F59E0B',

  overlay: 'rgba(5,5,16,0.72)',
  overlayLight: 'rgba(5,5,16,0.4)',

  // Brand aliases (backward compatible)
  pink: brand.pink,
  purple: brand.purple,
  blue: brand.cyan,
  orange: brand.orange,
  primary: brand.pink,
  primaryLight: brand.pinkLight,
  primaryDark: brand.pinkDark,
  primaryMuted: 'rgba(236,72,153,0.18)',
  secondary: brand.purple,
  accent: brand.cyan,

  gradient: [...actionGradient, brand.orange] as [string, string, string],
  gradientSoft: [brand.pink, brand.cyan] as [string, string],
  gradientVip: [...vipGradient] as [string, string, string],
  gradientBrand: [...brandGradient] as [string, string, string],
  gradientNight: [...nightGradient] as [string, string, string],
} as const;

export const lightColors = {
  bg: '#F7F5F8',
  bgElevated: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#F3F0F5',
  surfaceGlass: 'rgba(255,255,255,0.7)',

  border: 'rgba(15,10,30,0.08)',
  borderStrong: 'rgba(15,10,30,0.14)',
  divider: 'rgba(15,10,30,0.06)',

  text: '#0F0A1E',
  textSecondary: '#52526B',
  textMuted: '#8B8BA3',
  textInverse: '#FAFAFA',

  danger: '#E11D48',
  success: '#059669',
  warning: '#D97706',
  info: '#0891B2',

  online: '#059669',
  offline: '#8B8BA3',

  premiumGold: '#D97706',
  vip: '#B45309',

  overlay: 'rgba(15,10,30,0.45)',
  overlayLight: 'rgba(15,10,30,0.2)',

  pink: brand.pink,
  purple: brand.purple,
  blue: brand.cyan,
  orange: brand.orange,
  primary: brand.pink,
  primaryLight: brand.pinkLight,
  primaryDark: brand.pinkDark,
  primaryMuted: 'rgba(236,72,153,0.12)',
  secondary: brand.purple,
  accent: brand.cyan,

  gradient: [...actionGradient, brand.orange] as [string, string, string],
  gradientSoft: [brand.pink, brand.cyan] as [string, string],
  gradientVip: [...vipGradient] as [string, string, string],
  gradientBrand: [...brandGradient] as [string, string, string],
  gradientNight: ['#FDF2F8', '#F7F5F8', '#EEF2FF'] as [string, string, string],
} as const;

export type ThemeColors = typeof darkColors | typeof lightColors;
