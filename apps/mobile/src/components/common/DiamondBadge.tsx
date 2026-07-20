import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { formatCount } from '@/utils/format';

export function DiamondBadge({ amount }: { amount: number }) {
  const c = useThemeColors();
  return (
    <View style={[styles.row, { backgroundColor: c.primaryMuted }]}>
      <Ionicons name="diamond" size={14} color={c.pink} />
      <Text variant="captionBold" color={c.pink}>
        {formatCount(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
});
