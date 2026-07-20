import { darkColors, lightColors } from '@/theme/colors';
import { useThemeStore } from '@/store/theme';

export type ThemeColors = typeof darkColors | typeof lightColors;

export function useThemeColors(): ThemeColors {
  const resolved = useThemeStore((s) => s.resolved);
  return resolved === 'light' ? lightColors : darkColors;
}

export function useIsDark(): boolean {
  return useThemeStore((s) => s.resolved) !== 'light';
}
