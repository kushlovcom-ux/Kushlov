import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

/** Small unread count pill for icons / tabs. */
export function NavBadge({ count }: { count: number }) {
  const c = useThemeColors();
  if (!count || count < 1) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <View style={[styles.badge, { backgroundColor: c.pink }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  text: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
});
