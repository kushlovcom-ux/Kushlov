import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/common/Screen';
import { Header } from '@/components/common/Header';
import { Text } from '@/components/ui/Text';
import { useThemeStore, type ThemePreference } from '@/store/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { AppStackParamList } from '@/navigation/types';
import { spacing } from '@/theme';

const THEMES: ThemePreference[] = ['dark', 'light', 'system'];

export function SettingsScreen() {
  const c = useThemeColors();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <Screen scroll>
      <Header title="Settings" showBack />

      <Text variant="captionBold" muted style={{ marginBottom: spacing.sm }}>
        Appearance
      </Text>
      <View style={styles.row}>
        {THEMES.map((t) => (
          <Pressable
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
          </Pressable>
        ))}
      </View>

      <Text variant="captionBold" muted style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        Privacy
      </Text>
      <Pressable
        onPress={() => nav.navigate('BlockedUsers')}
        style={[styles.link, { borderColor: c.border }]}
      >
        <Ionicons name="ban-outline" size={20} color={c.textSecondary} />
        <Text style={{ flex: 1 }}>Blocked users</Text>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>
      <Pressable
        onPress={() => nav.navigate('Privacy')}
        style={[styles.link, { borderColor: c.border }]}
      >
        <Ionicons name="shield-outline" size={20} color={c.textSecondary} />
        <Text style={{ flex: 1 }}>Privacy</Text>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>
      <Pressable
        onPress={() => nav.navigate('LocationSetup')}
        style={[styles.link, { borderColor: c.border }]}
      >
        <Ionicons name="location-outline" size={20} color={c.textSecondary} />
        <Text style={{ flex: 1 }}>Location</Text>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>
      <Pressable
        onPress={() => nav.navigate('NotificationSettings')}
        style={[styles.link, { borderColor: c.border }]}
      >
        <Ionicons name="notifications-outline" size={20} color={c.textSecondary} />
        <Text style={{ flex: 1 }}>Notifications</Text>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>

      <Text variant="captionBold" muted style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        Support
      </Text>
      <Pressable
        onPress={() => nav.navigate('Contact')}
        style={[styles.link, { borderColor: c.border }]}
      >
        <Ionicons name="mail-outline" size={20} color={c.textSecondary} />
        <Text style={{ flex: 1 }}>Contact us</Text>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>

      <Pressable
        onPress={() => Alert.alert('Kushlov', 'Version 1.0.0\nBuilt for connection.')}
        style={[styles.link, { borderColor: c.border, marginTop: spacing.lg }]}
      >
        <Ionicons name="information-circle-outline" size={20} color={c.textSecondary} />
        <Text style={{ flex: 1 }}>About</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
