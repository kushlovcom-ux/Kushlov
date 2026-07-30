import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';
import { PressableScale } from './PressableScale';

type Props = {
  uri?: string | null;
  name: string;
  live?: boolean;
  onPress?: () => void;
};

/** Instagram-style story ring for online / live hosts. */
export function StoryRing({ uri, name, live, onPress }: Props) {
  const c = useThemeColors();
  return (
    <PressableScale onPress={onPress} style={styles.wrap} accessibilityLabel={name}>
      <LinearGradient
        colors={live ? [...c.gradient] : [c.blue, c.primary, c.orange]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ring}
      >
        <View style={[styles.inner, { backgroundColor: c.bg }]}>
          {uri ? (
            <Image source={{ uri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: c.elevated, alignItems: 'center', justifyContent: 'center' }]}>
              <Text variant="h3" color={c.primary}>
                {(name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
      {live ? (
        <View style={[styles.livePill, { backgroundColor: c.danger }]}>
          <Text variant="tiny" color="#fff" style={{ textTransform: 'uppercase', fontSize: 8 }}>
            Live
          </Text>
        </View>
      ) : null}
      <Text variant="tiny" numberOfLines={1} style={styles.name}>
        {name.split(' ')[0]}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 76,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    borderRadius: 32,
    padding: 2,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  livePill: {
    position: 'absolute',
    bottom: 18,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  name: {
    marginTop: 6,
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: '500',
    maxWidth: 72,
    textAlign: 'center',
  },
});
