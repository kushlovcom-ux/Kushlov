import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';

type Props = {
  visible: boolean;
  message?: string;
};

export function LoadingOverlay({ visible, message }: Props) {
  const c = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <View style={[styles.box, { backgroundColor: c.card }]}>
          <ActivityIndicator size="large" color={c.primary} />
          {message ? (
            <Text muted style={{ marginTop: spacing.md, textAlign: 'center' }}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    padding: spacing['2xl'],
    borderRadius: radius.lg,
    minWidth: 140,
    alignItems: 'center',
  },
});
