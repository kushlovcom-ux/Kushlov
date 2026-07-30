import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { Skeleton } from '@/components/ui/Skeleton';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { LiveCardPreview } from '@/components/live/LiveCardPreview';
import { PressableScale } from '@/design-system';
import { liveApi } from '@/api/live';
import { queryKeys } from '@/constants/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';
import { LiveStatus } from '@/types';
import type { AppStackParamList } from '@/navigation/types';
import type { LiveRoom } from '@/types';

const MAX_PREVIEWS = 4;

export function LiveListScreen() {
  const c = useThemeColors();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const list = useQuery({
    queryKey: queryKeys.live,
    queryFn: () => liveApi.list({ limit: 40 }),
  });
  const items: LiveRoom[] = (list.data?.items ?? []).filter((r) => r.status === LiveStatus.Live);

  return (
    <Screen padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <View style={styles.pad}>
        <Header
          title="Live"
          showBack
          right={
            user?.isHostApproved ? (
              <Button title="Go live" size="sm" onPress={() => nav.navigate('GoLive')} />
            ) : null
          }
        />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />
        }
      >
        {list.isLoading ? (
          <Skeleton height={200} />
        ) : list.isError ? (
          <ErrorView message="Could not load live rooms" onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No one is live" description="Check back soon or become a host." />
        ) : (
          items.map((room, index) => (
            <PressableScale
              key={room.id}
              onPress={() => nav.navigate('LiveRoom', { liveId: room.id })}
              style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <View style={styles.thumbWrap}>
                <LiveCardPreview
                  liveId={room.id}
                  thumbnailUrl={room.thumbnailUrl}
                  active={index < MAX_PREVIEWS}
                  style={styles.thumb}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(5,5,16,0.75)']}
                  style={styles.thumbFade}
                />
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text variant="tiny" color="#fff" style={{ textTransform: 'none' }}>
                    LIVE
                  </Text>
                </View>
              </View>
              <View style={styles.meta}>
                <Text variant="h3" numberOfLines={1}>
                  {room.title}
                </Text>
                <Text muted variant="caption">
                  {room.host?.displayName ?? 'Host'} · {room.viewerCount ?? 0} watching
                </Text>
                <View style={[styles.join, { backgroundColor: c.primaryMuted }]}>
                  <Text variant="captionBold" color={c.primary}>
                    Join room
                  </Text>
                </View>
              </View>
            </PressableScale>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  card: {
    borderRadius: radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  thumbWrap: { width: '100%', height: 180, backgroundColor: '#12081A' },
  thumb: { width: '100%', height: 180 },
  thumbFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '40%',
  },
  liveBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  meta: { padding: spacing.lg, gap: 6 },
  join: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
});
