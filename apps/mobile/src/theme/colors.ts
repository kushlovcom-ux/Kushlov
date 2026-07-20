export const brand = {
  pink: '#ec4899',
  purple: '#8b5cf6',
  orange: '#f97316',
} as const;

export const darkColors = {
  bg: '#0a0a0b',
  card: '#141416',
  elevated: '#1c1c1f',
  border: '#27272a',
  borderStrong: '#3f3f46',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  danger: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  info: '#3b82f6',
  overlay: 'rgba(0,0,0,0.65)',
  pink: brand.pink,
  purple: brand.purple,
  orange: brand.orange,
  primary: brand.pink,
  primaryMuted: 'rgba(236,72,153,0.15)',
  gradient: [brand.pink, brand.purple] as [string, string],
} as const;

export const lightColors = {
  bg: '#fafafa',
  card: '#ffffff',
  elevated: '#f4f4f5',
  border: '#e4e4e7',
  borderStrong: '#d4d4d8',
  text: '#09090b',
  textSecondary: '#52525b',
  textMuted: '#71717a',
  danger: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  info: '#2563eb',
  overlay: 'rgba(0,0,0,0.45)',
  pink: brand.pink,
  purple: brand.purple,
  orange: brand.orange,
  primary: brand.pink,
  primaryMuted: 'rgba(236,72,153,0.12)',
  gradient: [brand.pink, brand.purple] as [string, string],
} as const;

export type ThemeColors = typeof darkColors | typeof lightColors;
