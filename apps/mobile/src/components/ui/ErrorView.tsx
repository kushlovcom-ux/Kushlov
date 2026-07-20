import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { spacing } from '@/theme';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorView({ message = 'Something went wrong', onRetry }: Props) {
  return (
    <View style={styles.wrap}>
      <Text variant="h3" style={{ textAlign: 'center' }}>
        Unable to load
      </Text>
      <Text muted style={{ textAlign: 'center', marginTop: spacing.sm }}>
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
});
