import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';

type Props = {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  icon = 'sparkles-outline',
  actionLabel,
  onAction,
}: Props) {
  const c = useThemeColors();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: c.primaryMuted }]}>
        <Ionicons name={icon} size={28} color={c.primary} />
      </View>
      <Text variant="h3" center style={{ marginTop: spacing.lg }}>
        {title}
      </Text>
      {description ? (
        <Text muted center style={{ marginTop: spacing.sm, maxWidth: 280 }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          size="md"
          style={{ marginTop: spacing.xl }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
    minHeight: 220,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
