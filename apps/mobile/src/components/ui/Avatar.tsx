import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { initials } from '@/utils/format';

type Props = {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
};

export function Avatar({ uri, name, size = 44, style }: Props) {
  const c = useThemeColors();
  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: radius }, style as object]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: c.primaryMuted,
        },
        style,
      ]}
    >
      <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
