import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { haptics } from '@/utils/haptics';

type Props = {
  onPress?: () => void;
  children: React.ReactNode;
  size?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function IconButton({
  onPress,
  children,
  size = 40,
  style,
  accessibilityLabel,
}: Props) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.elevated,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
});
