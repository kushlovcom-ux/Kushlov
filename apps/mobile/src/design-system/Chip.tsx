import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { PressableScale } from './PressableScale';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';

type Tone = 'pink' | 'gold' | 'success' | 'info' | 'neutral';

const tones: Record<Tone, { bg: string; fg: string }> = {
  pink: { bg: 'rgba(236,72,153,0.2)', fg: '#F472B6' },
  gold: { bg: 'rgba(251,191,36,0.2)', fg: '#FBBF24' },
  success: { bg: 'rgba(52,211,153,0.18)', fg: '#34D399' },
  info: { bg: 'rgba(34,211,238,0.18)', fg: '#22D3EE' },
  neutral: { bg: 'rgba(255,255,255,0.08)', fg: '#A1A1B5' },
};

type Props = {
  label: string;
  tone?: Tone;
  gradient?: boolean;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, tone = 'neutral', gradient, selected, onPress }: Props) {
  const c = useThemeColors();
  const useGradient = gradient || selected;

  const content = useGradient ? (
    <LinearGradient
      colors={[...c.gradientSoft]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.chip}
    >
      <Text variant="tiny" color="#fff" style={{ textTransform: 'none', letterSpacing: 0.2 }}>
        {label}
      </Text>
    </LinearGradient>
  ) : (
    <View style={[styles.chip, { backgroundColor: tones[tone].bg, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]}>
      <Text
        variant="tiny"
        color={tones[tone].fg}
        style={{ textTransform: 'none', letterSpacing: 0.2 }}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.94} accessibilityLabel={label}>
        {content}
      </PressableScale>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
});
