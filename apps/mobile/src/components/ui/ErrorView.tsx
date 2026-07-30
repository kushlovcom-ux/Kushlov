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
      <Text variant="h3" style={{ textAlign: 'center', marginTop: spacing.lg }}>
        Unable to load
      </Text>
      <Text muted style={{ textAlign: 'center', marginTop: spacing.sm, maxWidth: 280 }}>
        {message}
      </Text>
      {onRetry ? (
        <Button title="Try again" onPress={onRetry} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    minHeight: 200,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
