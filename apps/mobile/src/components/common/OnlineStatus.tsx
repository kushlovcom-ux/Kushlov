import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  online?: boolean;
  size?: number;
  absolute?: boolean;
};

export function OnlineStatus({ online, size = 12, absolute }: Props) {
  const c = useThemeColors();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: online ? c.success : c.textMuted,
          borderWidth: 2,
          borderColor: c.card,
        },
        absolute && styles.abs,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', right: 0, bottom: 0 },
});
