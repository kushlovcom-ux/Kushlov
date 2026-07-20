import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/common/Screen';
import { Header } from '@/components/common/Header';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { authApi, walletApi } from '@/api';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { AppStackParamList } from '@/navigation/types';
import { displayName, formatDiamonds } from '@/utils/format';
import { spacing } from '@/theme';

const LINKS: Array<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof AppStackParamList;
}> = [
  { label: 'Edit profile', icon: 'create-outline', route: 'EditProfile' },
  { label: 'Wallet', icon: 'diamond-outline', route: 'Wallet' },
  { label: 'Call history', icon: 'call-outline', route: 'History' },
  { label: 'Become a host', icon: 'star-outline', route: 'BecomeHost' },
  { label: 'Settings', icon: 'settings-outline', route: 'Settings' },
  { label: 'Contact support', icon: 'mail-outline', route: 'Contact' },
];

export function ProfileScreen() {
  const c = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const wallet = useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => walletApi.get(),
  });

  const logout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await authApi.logout();
          } catch {
            /* ignore */
          }
          clear();
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Header
        title="Profile"
        right={
          <Pressable onPress={() => nav.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={c.text} />
          </Pressable>
        }
      />
      <View style={styles.hero}>
        <Avatar uri={user?.avatarUrl} name={displayName(user)} size={88} />
        <Text variant="h2" style={{ marginTop: spacing.md }}>
          {displayName(user)}
        </Text>
        <Text muted>@{user?.username}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
          {user?.isHostApproved ? <Badge label="Host" tone="pink" /> : null}
          {user?.country ? <Badge label={user.country} /> : null}
        </View>
      </View>

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={styles.walletRow}>
          <View>
            <Text muted variant="caption">
              Diamonds
            </Text>
            <Text variant="h3" color={c.primary}>
              {formatDiamonds(wallet.data?.diamonds ?? 0)}
            </Text>
          </View>
          <View>
            <Text muted variant="caption">
              Gold
            </Text>
            <Text variant="h3" color={c.orange}>
              {formatDiamonds(wallet.data?.gold ?? 0)}
            </Text>
          </View>
          <Button title="Top up" size="sm" onPress={() => nav.navigate('Wallet')} />
        </View>
      </Card>

      {LINKS.map((link) => (
        <Pressable
          key={link.route}
          onPress={() => nav.navigate(link.route as never)}
          style={[styles.link, { borderBottomColor: c.border }]}
        >
          <Ionicons name={link.icon} size={20} color={c.textSecondary} />
          <Text style={{ flex: 1 }}>{link.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </Pressable>
      ))}

      <Button
        title="Sign out"
        variant="danger"
        onPress={logout}
        fullWidth
        style={{ marginTop: spacing['2xl'] }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  walletRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
