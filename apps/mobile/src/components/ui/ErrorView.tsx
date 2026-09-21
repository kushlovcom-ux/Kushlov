import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorView({ message = 'Something went wrong', onRetry }: Props) {
  const c = useThemeColors();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: 'rgba(244,63,94,0.15)' }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={c.danger} />
      </View>
      <Text variant="h3" center style={{ marginTop: spacing.lg }}>
        Unable to load
      </Text>
      <Text muted center style={{ marginTop: spacing.sm, maxWidth: 280 }}>
        {message}
      </Text>
      {onRetry ? (
        <Button
          title="Try again"
          onPress={onRetry}
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
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
