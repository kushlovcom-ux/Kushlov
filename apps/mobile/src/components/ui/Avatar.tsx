import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { initials } from '@/utils/format';
import { getPremiumAvatar } from '@/utils/avatar';

type Props = {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
};

export function Avatar({ uri, name, size = 44, style }: Props) {
  const c = useThemeColors();
  const radius = size / 2;
  const [loadError, setLoadError] = useState(false);

  const effectiveUri = uri?.trim() ? uri : getPremiumAvatar(name);

  if (effectiveUri && !loadError) {
    return (
      <Image
        source={{ uri: effectiveUri }}
        onError={() => setLoadError(true)}
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
