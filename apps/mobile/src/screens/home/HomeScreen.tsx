import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { ErrorView } from '@/components/ui/ErrorView';
import { UserCard } from '@/components/common/UserCard';
import { DiamondBadge } from '@/components/common/DiamondBadge';
import { Screen } from '@/components/common/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useBadges } from '@/hooks/useBadges';
import { usePopularHosts, useTopRatedHosts } from '@/hooks/usePopularHosts';
import { usePlatformStats, useSettings } from '@/hooks/useSettings';
import { useDiscover } from '@/hooks/useDiscover';
import { useWallet } from '@/hooks/useWallet';
import { useThemeColors } from '@/hooks/useThemeColors';
import { NavBadge } from '@/components/common/NavBadge';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';
import type { PublicUser } from '@/types';

export function HomeScreen() {
  const c = useThemeColors();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const badges = useBadges();
  const popular = usePopularHosts();
  const topRated = useTopRatedHosts();
  const online = useDiscover({ online: true, limit: 12 });
  const stats = usePlatformStats();
  const settings = useSettings();
  const { wallet } = useWallet();

  const popularItems = popular.data ?? [];
  const topItems = topRated.data?.items ?? [];
  const onlineItems = online.data?.pages.flatMap((p) => p.items) ?? [];
  const loading = popular.isLoading || topRated.isLoading;
  const notifCount =
    badges.data?.notifications ?? badges.data?.unreadNotifications ?? 0;
  const onlineCount = Math.max(
    stats.data?.onlineUsers ?? 0,
    onlineItems.filter((u) => u.isOnline).length,
  );

  return (
    <Screen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pad}>
        <View style={styles.top}>
          <Pressable
            onPress={() => nav.navigate('MainTabs', { screen: 'Home' })}
            accessibilityRole="button"
            accessibilityLabel="Kushlov home"
            style={styles.brandTap}
          >
            <Image
              source={require('../../assets/images/kush.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View>
              <Text variant="caption" muted>
                Kushlov
              </Text>
              <Text variant="h2">{user?.displayName ?? 'Explorer'}</Text>
            </View>
          </Pressable>
          <View style={styles.topRight}>
            {wallet.data ? <DiamondBadge amount={wallet.data.diamonds} /> : null}
            <Pressable
              onPress={() => nav.navigate('Contact')}
              accessibilityLabel="Contact us"
              hitSlop={8}
            >
              <Ionicons name="mail-outline" size={24} color={c.text} />
            </Pressable>
            <Pressable
              onPress={() => nav.navigate('Notifications')}
              accessibilityLabel="Notifications"
              style={{ position: 'relative' }}
              hitSlop={8}
            >
              <Ionicons name="notifications-outline" size={24} color={c.text} />
              <NavBadge count={notifCount} />
            </Pressable>
            <Pressable onPress={() => nav.navigate('Profile')}>
              <Avatar uri={user?.avatarUrl} name={user?.displayName} size={36} />
            </Pressable>
          </View>
        </View>

        {settings.data?.announcements?.[0]?.text ? (
          <View style={[styles.banner, { backgroundColor: c.primaryMuted }]}>
            <Text variant="caption" color={c.pink}>
              {settings.data.announcements[0].text}
            </Text>
          </View>
        ) : null}

        {stats.data || onlineItems.length > 0 ? (
          <Text variant="caption" muted style={{ marginBottom: spacing.md }}>
            {onlineCount} online · {stats.data?.liveStreams ?? 0} live
          </Text>
        ) : null}

        <Section title="Popular hosts" onSeeAll={() => nav.navigate('MainTabs', { screen: 'Discover' })}>
          {loading ? (
            <SkeletonRow />
          ) : popular.isError ? (
            <ErrorView message="Could not load popular hosts" onRetry={() => popular.refetch()} />
          ) : (
            <FlashList
              horizontal
              data={popularItems}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item: PublicUser) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => nav.navigate('PublicProfile', { userId: item.id })}
                  style={[styles.hostChip, { backgroundColor: c.card, borderColor: c.border }]}
                >
                  <Avatar uri={item.avatarUrl} name={item.displayName} size={72} />
                  <Text variant="captionBold" numberOfLines={1} style={{ marginTop: 8, maxWidth: 88 }}>
                    {item.displayName}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </Section>

        <Section title="Top rated">
          {topItems.slice(0, 5).map((u) => (
            <View key={u.id} style={{ marginBottom: 10 }}>
              <UserCard user={u} onPress={() => nav.navigate('PublicProfile', { userId: u.id })} />
            </View>
          ))}
        </Section>

        <Section title="Online now">
          <View style={styles.grid}>
            {onlineItems.slice(0, 8).map((u) => (
              <View key={u.id} style={styles.gridItem}>
                <UserCard
                  user={u}
                  variant="portrait"
                  onPress={() => nav.navigate('PublicProfile', { userId: u.id })}
                />
              </View>
            ))}
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  children,
  onSeeAll,
}: {
  title: string;
  children: React.ReactNode;
  onSeeAll?: () => void;
}) {
  return (
    <View style={{ marginBottom: spacing['2xl'] }}>
      <View style={styles.sectionHead}>
        <Text variant="h3">{title}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll}>
            <Text variant="caption" color="#ec4899">
              See all
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, paddingBottom: 40 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  brandTap: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  logo: { width: 36, height: 36, borderRadius: 10 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  banner: { padding: spacing.md, borderRadius: 12, marginBottom: spacing.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  hostChip: {
    width: 110,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', flexGrow: 1 },
});
