import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useIsDark } from '@/hooks/useThemeColors';
import { radius } from '@/theme';

type Props = ViewProps & {
  intensity?: number;
};

export function GlassView({ intensity = 40, style, children, ...rest }: Props) {
  const c = useThemeColors();
  const dark = useIsDark();

  if (Platform.OS === 'android') {
    return (
      <View
        style={[
          styles.base,
          { backgroundColor: dark ? 'rgba(20,20,22,0.92)' : 'rgba(255,255,255,0.92)' },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={dark ? 'dark' : 'light'}
      style={[styles.base, { overflow: 'hidden', borderColor: c.border }, style]}
      {...rest}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
