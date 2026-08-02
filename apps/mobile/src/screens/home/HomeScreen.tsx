import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { NavBadge } from '@/components/common/NavBadge';
import {
  Chip,
  GlassCard,
  QuickAction,
  SectionHeader,
  StoryRing,
} from '@/design-system';
import { useAuth } from '@/hooks/useAuth';
import { useBadges } from '@/hooks/useBadges';
import { usePopularHosts, useTopRatedHosts } from '@/hooks/usePopularHosts';
import { usePlatformStats, useSettings } from '@/hooks/useSettings';
import { useDiscover } from '@/hooks/useDiscover';
import { useWallet } from '@/hooks/useWallet';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';
import { Role, type PublicUser } from '@/types';

function greetingForHour(h: number) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const c = useThemeColors();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const badges = useBadges();
  const popular = usePopularHosts();
  const topRated = useTopRatedHosts();
  const online = useDiscover({ online: true, limit: 16 });
  const stats = usePlatformStats();
  const settings = useSettings();
  const { wallet } = useWallet();

  const popularItems = popular.data ?? [];
  const topItems = topRated.data?.items ?? [];
  const onlineItems = online.data?.pages.flatMap((p) => p.items) ?? [];
  const trulyOnline = useMemo(
    () => onlineItems.filter((u) => u.isOnline === true),
    [onlineItems],
  );
  const loading = popular.isLoading || topRated.isLoading;
  const notifCount =
    badges.data?.notifications ?? badges.data?.unreadNotifications ?? 0;
  const onlineCount = Math.max(stats.data?.onlineUsers ?? 0, trulyOnline.length);
  const firstName = (user?.displayName ?? 'Explorer').split(' ')[0];
  const hello = useMemo(() => greetingForHour(new Date().getHours()), []);
  const canGoLive =
    user?.role === Role.Host || user?.role === Role.Admin || Boolean(user?.isHostApproved);

  const storyData: PublicUser[] = useMemo(() => trulyOnline.slice(0, 12), [trulyOnline]);

  return (
    <Screen padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pad}
      >
        {/* Header */}
        <View style={styles.top}>
          <View style={styles.brandTap}>
            <Image
              source={require('../../assets/images/kush.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={{ flexShrink: 1 }}>
              <Text variant="caption" muted>
                {hello}
              </Text>
              <Text variant="h2" numberOfLines={1}>
                {firstName}
              </Text>
            </View>
          </View>
          <View style={styles.topRight}>
            {wallet.data ? (
              <Pressable onPress={() => nav.navigate('Wallet')} hitSlop={8}>
                <DiamondBadge amount={wallet.data.diamonds} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => nav.navigate('Notifications')}
              accessibilityLabel="Notifications"
              style={styles.iconBtn}
              hitSlop={8}
            >
              <Ionicons name="notifications-outline" size={22} color={c.text} />
              <NavBadge count={notifCount} />
            </Pressable>
            <Pressable onPress={() => nav.navigate('MainTabs', { screen: 'Profile' })}>
              <Avatar uri={user?.avatarUrl} name={user?.displayName} size={40} />
            </Pressable>
          </View>
        </View>

        {/* Hero stats */}
        <GlassCard glow style={styles.heroCard}>
          <Text variant="label" color={c.primaryLight ?? c.pink}>
            Kushlov Live
          </Text>
          <Text variant="h3" style={{ marginTop: 4 }}>
            {onlineCount} online · {stats.data?.liveStreams ?? 0} live now
          </Text>
          <Text variant="caption" muted style={{ marginTop: 4 }}>
            Meet, match, chat, call & go live — premium connections.
          </Text>
          <View style={styles.heroChips}>
            <Chip label="Verified hosts" tone="pink" />
            <Chip label="Secure gifts" tone="gold" />
            <Chip label="HD calls" tone="info" />
          </View>
        </GlassCard>

        {settings.data?.announcements?.[0]?.text ? (
          <View style={[styles.banner, { backgroundColor: c.primaryMuted, borderColor: c.border }]}>
            <Ionicons name="megaphone-outline" size={16} color={c.primary} />
            <Text variant="caption" color={c.pink} style={{ flex: 1 }}>
              {settings.data.announcements[0].text}
            </Text>
          </View>
        ) : null}

        {/* Quick actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actions}
        >
          <QuickAction
            icon="compass"
            label="Discover"
            gradient
            onPress={() => nav.navigate('MainTabs', { screen: 'Discover' })}
          />
          <QuickAction
            icon="radio"
            label="Live"
            onPress={() => nav.navigate('LiveList')}
          />
          <QuickAction
            icon="heart"
            label="Matches"
            onPress={() => nav.navigate('MainTabs', { screen: 'Matches' })}
          />
          <QuickAction
            icon="wallet"
            label="Wallet"
            onPress={() => nav.navigate('Wallet')}
          />
          {canGoLive ? (
            <QuickAction
              icon="videocam"
              label="Go Live"
              onPress={() => nav.navigate('GoLive')}
            />
          ) : null}
        </ScrollView>

        {/* Stories / online */}
        <SectionHeader
          title="Active now"
          subtitle="People online near you"
          actionLabel="See all"
          onAction={() => nav.navigate('MainTabs', { screen: 'Discover' })}
        />
        <FlashList
          horizontal
          data={storyData}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.screen }}
          keyExtractor={(item: PublicUser) => item.id}
          renderItem={({ item }) => (
            <StoryRing
              uri={item.avatarUrl}
              name={item.displayName}
              onPress={() => nav.navigate('PublicProfile', { userId: item.id })}
            />
          )}
          ListEmptyComponent={
            loading ? <SkeletonRow /> : (
              <Text variant="caption" muted style={{ paddingHorizontal: spacing.screen }}>
                No one online yet — check Discover.
              </Text>
            )
          }
        />

        {/* Popular hosts */}
        <View style={{ marginTop: spacing['2xl'] }}>
          <SectionHeader
            title="Popular hosts"
            subtitle="Hand-picked for you"
            actionLabel="Explore"
            onAction={() => nav.navigate('MainTabs', { screen: 'Discover' })}
          />
          {loading ? (
            <View style={{ paddingHorizontal: spacing.screen }}>
              <SkeletonRow />
            </View>
          ) : popular.isError ? (
            <View style={{ paddingHorizontal: spacing.screen }}>
              <ErrorView message="Could not load popular hosts" onRetry={() => popular.refetch()} />
            </View>
          ) : (
            <FlashList
              horizontal
              data={popularItems}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.screen }}
              keyExtractor={(item: PublicUser) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => nav.navigate('PublicProfile', { userId: item.id })}
                  style={[styles.hostChip, { backgroundColor: c.card, borderColor: c.border }]}
                >
                  <Avatar uri={item.avatarUrl} name={item.displayName} size={72} />
                  <Text variant="captionBold" numberOfLines={1} style={styles.hostName}>
                    {item.displayName}
                  </Text>
                  {item.isOnline ? (
                    <Chip label="Online" tone="success" />
                  ) : (
                    <Chip label="Host" tone="pink" />
                  )}
                </Pressable>
              )}
            />
          )}
        </View>

        {/* Top rated */}
        <View style={{ marginTop: spacing['2xl'] }}>
          <SectionHeader title="Top rated" subtitle="Highest reviews" />
          <View style={{ paddingHorizontal: spacing.screen }}>
            {topItems.slice(0, 5).map((u) => (
              <View key={u.id} style={{ marginBottom: spacing.md }}>
                <UserCard user={u} onPress={() => nav.navigate('PublicProfile', { userId: u.id })} />
              </View>
            ))}
          </View>
        </View>

        {/* Online grid */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="New & nearby" subtitle="Recently active" />
          <View style={[styles.grid, { paddingHorizontal: spacing.screen }]}>
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
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingTop: spacing.sm, paddingBottom: 110 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.screen,
  },
  brandTap: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  logo: { width: 42, height: 42, borderRadius: 12 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.lg,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  hostChip: {
    width: 118,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.sm,
    gap: 6,
  },
  hostName: { marginTop: 4, maxWidth: 96, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', flexGrow: 1 },
});
