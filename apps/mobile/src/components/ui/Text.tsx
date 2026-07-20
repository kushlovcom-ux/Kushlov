import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { typography } from '@/theme/typography';

type Variant = keyof typeof typography;

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  secondary?: boolean;
  center?: boolean;
};

export function Text({
  variant = 'body',
  color,
  muted,
  secondary,
  center,
  style,
  ...rest
}: Props) {
  const c = useThemeColors();
  const resolved =
    color ?? (muted || secondary ? c.textSecondary : c.text);
  return (
    <RNText
      style={[
        typography[variant],
        { color: resolved },
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}

export const textStyles = StyleSheet.create({});
