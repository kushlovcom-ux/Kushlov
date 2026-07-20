import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing, typography } from '@/theme';
import { Text } from './Text';

type Props = {
  label: string;
  tone?: 'default' | 'pink' | 'purple' | 'orange' | 'success' | 'danger' | 'muted';
};

export function Badge({ label, tone = 'default' }: Props) {
  const c = useThemeColors();
  const map = {
    default: { bg: c.elevated, fg: c.textSecondary },
    muted: { bg: c.elevated, fg: c.textMuted },
    pink: { bg: c.primaryMuted, fg: c.pink },
    purple: { bg: 'rgba(139,92,246,0.15)', fg: c.purple },
    orange: { bg: 'rgba(249,115,22,0.15)', fg: c.orange },
    success: { bg: 'rgba(34,197,94,0.15)', fg: c.success },
    danger: { bg: 'rgba(239,68,68,0.15)', fg: c.danger },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[typography.tiny, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
});
