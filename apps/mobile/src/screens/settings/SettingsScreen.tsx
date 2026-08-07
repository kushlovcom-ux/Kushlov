import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/common/Screen';
import { Header } from '@/components/common/Header';
import { Text } from '@/components/ui/Text';
import { GlassCard, PressableScale } from '@/design-system';
import { useThemeStore, type ThemePreference } from '@/store/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { AppStackParamList } from '@/navigation/types';
import { radius, spacing } from '@/theme';

const THEMES: ThemePreference[] = ['dark', 'light', 'system'];

type Link = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function SettingsScreen() {
  const c = useThemeColors();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const privacy: Link[] = [
    { label: 'Blocked users', icon: 'ban-outline', onPress: () => nav.navigate('BlockedUsers') },
    { label: 'Privacy', icon: 'shield-outline', onPress: () => nav.navigate('Privacy') },
    { label: 'Location', icon: 'location-outline', onPress: () => nav.navigate('LocationSetup') },
    {
      label: 'Notifications',
      icon: 'notifications-outline',
      onPress: () => nav.navigate('NotificationSettings'),
    },
  ];

  const support: Link[] = [
    { label: 'Contact us', icon: 'mail-outline', onPress: () => nav.navigate('Contact') },
    {
      label: 'About',
      icon: 'information-circle-outline',
      onPress: () => Alert.alert('Kushlov', 'Version 1.0.0\nBuilt for connection.'),
    },
  ];

  const renderGroup = (title: string, items: Link[]) => (
    <View style={{ marginBottom: spacing.xl }}>
      <Text variant="captionBold" muted style={{ marginBottom: spacing.sm }}>
        {title}
      </Text>
      <GlassCard padded={false}>
        {items.map((item, i) => (
          <PressableScale
            key={item.label}
            onPress={item.onPress}
            style={[
              styles.link,
              {
                borderBottomColor: c.divider,
                borderBottomWidth: i === items.length - 1 ? 0 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: c.primaryMuted }]}>
              <Ionicons name={item.icon} size={18} color={c.primary} />
            </View>
            <Text style={{ flex: 1 }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </PressableScale>
        ))}
      </GlassCard>
    </View>
  );

  return (
    <Screen scroll padded={false} onRefresh={async () => undefined}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <View style={styles.pad}>
        <Header title="Settings" showBack />

        <Text variant="captionBold" muted style={{ marginBottom: spacing.sm }}>
          Appearance
        </Text>
        <View style={styles.row}>
          {THEMES.map((t) => (
            <PressableScale
              key={t}
              onPress={() => setPreference(t)}
              style={[
                styles.chip,
                {
                  backgroundColor: preference === t ? c.primaryMuted : c.elevated,
                  borderColor: preference === t ? c.primary : c.border,
                },
              ]}
            >
              <Text
                variant="captionBold"
                color={preference === t ? c.primary : c.textSecondary}
                style={{ textTransform: 'capitalize' }}
              >
                {t}
              </Text>
            </PressableScale>
          ))}
        </View>

        {renderGroup('Privacy', privacy)}
        {renderGroup('Support', support)}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen, paddingBottom: spacing['4xl'] },
  row: { flexDirection: 'row', gap: 8, marginBottom: spacing.xl },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
