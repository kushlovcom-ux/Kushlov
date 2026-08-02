import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/common/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { GlassCard, PressableScale } from '@/design-system';
import { authApi, walletApi } from '@/api';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { AppStackParamList } from '@/navigation/types';
import { Role } from '@/types';
import { displayName, formatDiamonds } from '@/utils/format';
import { radius, spacing } from '@/theme';

const ALL_LINKS: Array<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof AppStackParamList;
  hostOnlyHide?: boolean;
}> = [
  { label: 'Edit profile', icon: 'create-outline', route: 'EditProfile' },
  { label: 'Wallet', icon: 'diamond-outline', route: 'Wallet' },
  { label: 'Call history', icon: 'call-outline', route: 'History' },
  {
    label: 'Become a host',
    icon: 'star-outline',
    route: 'BecomeHost',
    hostOnlyHide: true,
  },
  { label: 'Settings', icon: 'settings-outline', route: 'Settings' },
  { label: 'Contact Us', icon: 'mail-outline', route: 'Contact' },
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

  const isHost =
    user?.role === Role.Host || user?.role === Role.Admin || Boolean(user?.isHostApproved);
  const links = ALL_LINKS.filter((link) => !(link.hostOnlyHide && isHost));

  return (
    <Screen padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Text variant="display">Profile</Text>
          <Pressable
            onPress={() => nav.navigate('Notifications')}
            hitSlop={12}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={24} color={c.text} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <LinearGradient colors={[...c.gradientBrand]} style={styles.avatarRing}>
            <View style={[styles.avatarInner, { backgroundColor: c.bg }]}>
              <Avatar uri={user?.avatarUrl} name={displayName(user)} size={96} />
            </View>
          </LinearGradient>
          <Text variant="h1" style={{ marginTop: spacing.md }}>
            {displayName(user)}
          </Text>
          <Text muted>@{user?.username}</Text>
          <View style={styles.badges}>
            {user?.isHostApproved ? <Badge label="Host" tone="pink" /> : null}
            {user?.country ? <Badge label={user.country} /> : null}
          </View>
          <Button
            title="Edit profile"
            size="sm"
            variant="secondary"
            onPress={() => nav.navigate('EditProfile')}
            style={{ marginTop: spacing.md }}
          />
        </View>

        <GlassCard glow style={{ marginBottom: spacing.lg }}>
          <View style={styles.walletRow}>
            <View>
              <Text muted variant="caption">
                Diamonds
              </Text>
              <Text variant="h2" color={c.primary}>
                {formatDiamonds(wallet.data?.diamonds ?? 0)}
              </Text>
            </View>
            {isHost ? (
              <View>
                <Text muted variant="caption">
                  Gold
                </Text>
                <Text variant="h2" color={c.premiumGold}>
                  {formatDiamonds(wallet.data?.gold ?? 0)}
                </Text>
              </View>
            ) : null}
            <Button title="Top up" size="sm" onPress={() => nav.navigate('Wallet')} />
          </View>
        </GlassCard>

        <GlassCard padded={false} style={{ marginBottom: spacing.xl }}>
          {links.map((link, i) => (
            <PressableScale
              key={link.route}
              onPress={() => nav.navigate(link.route as never)}
              style={[
                styles.link,
                {
                  borderBottomColor: c.divider,
                  borderBottomWidth: i === links.length - 1 ? 0 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={[styles.linkIcon, { backgroundColor: c.primaryMuted }]}>
                <Ionicons name={link.icon} size={18} color={c.primary} />
              </View>
              <Text style={{ flex: 1 }}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </PressableScale>
          ))}
        </GlassCard>

        <Button title="Sign out" variant="primary" onPress={logout} fullWidth size="lg" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 102,
    height: 102,
    borderRadius: 51,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
