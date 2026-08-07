import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { useThemeColors, useIsDark } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';
import { PressableScale } from './PressableScale';

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', idle: 'home-outline' },
  Discover: { active: 'compass', idle: 'compass-outline' },
  Matches: { active: 'heart', idle: 'heart-outline' },
  Messages: { active: 'chatbubbles', idle: 'chatbubbles-outline' },
  Profile: { active: 'person', idle: 'person-outline' },
  Live: { active: 'radio', idle: 'radio-outline' },
  Wallet: { active: 'wallet', idle: 'wallet-outline' },
};

/** Floating glass tab bar — dating-app premium feel. */
export function PremiumTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.wrap, { paddingBottom: bottom }]} pointerEvents="box-none">
      <BlurView
        intensity={dark ? 55 : 80}
        tint={dark ? 'dark' : 'light'}
        style={[
          styles.bar,
          {
            backgroundColor: dark ? 'rgba(18,18,28,0.72)' : 'rgba(255,255,255,0.82)',
            borderColor: c.border,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const icons = ICONS[route.name] ?? { active: 'ellipse', idle: 'ellipse-outline' };
          const color = focused ? c.primary : c.textMuted;
          const badge = options.tabBarBadge;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <PressableScale
              key={route.key}
              onPress={onPress}
              accessibilityLabel={String(label)}
              style={styles.item}
              scaleTo={0.9}
            >
              <View>
                <Ionicons
                  name={focused ? icons.active : icons.idle}
                  size={20}
                  color={color}
                />
                {badge != null && Number(badge) > 0 ? (
                  <View style={[styles.badge, { backgroundColor: c.primary }]}>
                    <Text variant="tiny" color="#fff" style={styles.badgeText}>
                      {Number(badge) > 99 ? '99+' : String(badge)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                variant="tiny"
                color={color}
                style={[styles.label, focused && { fontWeight: '700' }]}
              >
                {label}
              </Text>
              {focused ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
            </PressableScale>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 4,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 12 },
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 2,
    minHeight: 44,
  },
  label: {
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 9,
    fontWeight: '500',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    textTransform: 'none',
    fontSize: 9,
    letterSpacing: 0,
  },
});
