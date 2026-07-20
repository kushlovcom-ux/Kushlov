import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Text } from '@/components/ui/Text';

export function TypingIndicator({ visible }: { visible: boolean }) {
  const c = useThemeColors();
  if (!visible) return null;
  return (
    <View style={styles.row}>
      <Dot delay={0} color={c.textMuted} />
      <Dot delay={150} color={c.textMuted} />
      <Dot delay={300} color={c.textMuted} />
      <Text variant="tiny" muted style={{ marginLeft: 6 }}>
        typing…
      </Text>
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(-4, { duration: 250 }), withTiming(0, { duration: 250 })),
        -1,
        false,
      ),
    );
  }, [delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4 },
});
