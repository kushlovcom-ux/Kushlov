export const brand = {
  pink: '#EC4899',
  purple: '#8B5CF6',
  blue: '#22D3EE',
  orange: '#F97316',
} as const;

export const darkColors = {
  bg: '#050508',
  card: '#121218',
  elevated: '#1A1A22',
  border: '#2A2A35',
  borderStrong: '#3F3F4A',
  text: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  info: brand.blue,
  overlay: 'rgba(0,0,0,0.65)',
  pink: brand.pink,
  purple: brand.purple,
  blue: brand.blue,
  orange: brand.orange,
  primary: brand.pink,
  primaryMuted: 'rgba(236,72,153,0.16)',
  /** Logo-matched CTA gradient: magenta → purple → orange */
  gradient: [brand.pink, brand.purple, brand.orange] as [string, string, string],
  gradientSoft: [brand.pink, brand.blue] as [string, string],
} as const;

export const lightColors = {
  bg: '#FAFAFA',
  card: '#FFFFFF',
  elevated: '#F4F4F5',
  border: '#E4E4E7',
  borderStrong: '#D4D4D8',
  text: '#09090B',
  textSecondary: '#52525B',
  textMuted: '#71717A',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
  info: '#0284C7',
  overlay: 'rgba(0,0,0,0.45)',
  pink: brand.pink,
  purple: brand.purple,
  blue: brand.blue,
  orange: brand.orange,
  primary: brand.pink,
  primaryMuted: 'rgba(236,72,153,0.12)',
  gradient: [brand.pink, brand.purple, brand.orange] as [string, string, string],
  gradientSoft: [brand.pink, brand.blue] as [string, string],
} as const;

export type ThemeColors = typeof darkColors | typeof lightColors;
