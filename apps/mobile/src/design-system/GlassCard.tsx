import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors, useIsDark } from '@/hooks/useThemeColors';
import { elevation, radius, spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  glow?: boolean;
  blur?: boolean;
};

/** Frosted / elevated surface card. */
export function GlassCard({ children, style, padded = true, glow, blur }: Props) {
  const c = useThemeColors();
  const dark = useIsDark();

  const body = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: blur ? 'transparent' : c.card,
          borderColor: c.border,
        },
        glow ? elevation.md : elevation.sm,
        padded && styles.padded,
        style,
      ]}
    >
      {glow ? (
        <LinearGradient
          colors={['rgba(236,72,153,0.12)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      ) : null}
      {children}
    </View>
  );

  if (blur) {
    return (
      <BlurView
        intensity={dark ? 40 : 60}
        tint={dark ? 'dark' : 'light'}
        style={[styles.base, { borderColor: c.border, overflow: 'hidden' }, style]}
      >
        <View style={[padded && styles.padded, { backgroundColor: c.surfaceGlass }]}>{children}</View>
      </BlurView>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
});
