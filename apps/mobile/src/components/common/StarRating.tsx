import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';

type Props = {
  rating?: number;
  count?: number;
  size?: number;
};

export function StarRating({ rating = 0, count, size = 14 }: Props) {
  const c = useThemeColors();
  const full = Math.round(rating);
  return (
    <View style={styles.row}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < full ? 'star' : 'star-outline'}
          size={size}
          color={c.orange}
        />
      ))}
      {rating > 0 ? (
        <Text variant="caption" muted style={{ marginLeft: 4 }}>
          {rating.toFixed(1)}
          {count != null ? ` (${count})` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1 },
});
