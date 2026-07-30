import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { elevation, radius, spacing } from '@/theme';
import { PressableScale } from './PressableScale';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  gradient?: boolean;
};

export function QuickAction({ icon, label, onPress, gradient }: Props) {
  const c = useThemeColors();

  return (
    <PressableScale onPress={onPress} style={styles.wrap} accessibilityLabel={label}>
      {gradient ? (
        <LinearGradient colors={[...c.gradient]} style={styles.iconBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name={icon} size={22} color="#fff" />
        </LinearGradient>
      ) : (
        <View style={[styles.iconBox, { backgroundColor: c.elevated, borderColor: c.border }, elevation.sm]}>
          <Ionicons name={icon} size={22} color={c.primary} />
        </View>
      )}
      <Text variant="captionBold" style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: 72,
    gap: spacing.xs,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  label: {
    textAlign: 'center',
  },
});
