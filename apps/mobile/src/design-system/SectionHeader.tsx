import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import { PressableScale } from './PressableScale';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Skip horizontal inset when parent already pads. */
  flush?: boolean;
};

export function SectionHeader({ title, subtitle, actionLabel, onAction, flush }: Props) {
  const c = useThemeColors();
  return (
    <View style={[styles.row, flush ? null : styles.inset]}>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        {subtitle ? (
          <Text variant="caption" muted style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} haptic>
          <Text variant="label" color={c.primary}>
            {actionLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inset: {
    paddingHorizontal: spacing.screen,
  },
});
