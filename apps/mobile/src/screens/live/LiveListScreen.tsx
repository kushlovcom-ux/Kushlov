import React from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
import { liveApi } from '@/api/live';
import { queryKeys } from '@/constants/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';
import type { LiveRoom } from '@/types';

export function LiveListScreen() {
  const c = useThemeColors();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const list = useQuery({
    queryKey: queryKeys.live,
    queryFn: () => liveApi.list({ limit: 40 }),
  });
  const items: LiveRoom[] = list.data?.items ?? [];

  return (
    <Screen>
      <Header
        title="Live"
        right={
          user?.isHostApproved ? (
            <Button title="Go live" size="sm" onPress={() => nav.navigate('GoLive')} />
          ) : null
        }
      />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />
        }
      >
        {list.isLoading ? (
          <Skeleton height={160} />
        ) : list.isError ? (
          <ErrorView message="Could not load live rooms" onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No one is live" description="Check back soon or become a host." />
        ) : (
          items.map((room) => (
            <Pressable
              key={room.id}
              onPress={() => nav.navigate('LiveRoom', { liveId: room.id })}
              style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
            >
              {room.thumbnailUrl ? (
                <Image source={{ uri: room.thumbnailUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: c.elevated }]} />
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="bodyBold" numberOfLines={1}>
                  {room.title}
                </Text>
                <Text muted variant="caption">
                  {room.host?.displayName ?? 'Host'} · {room.viewerCount ?? 0} watching
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    alignItems: 'center',
  },
  thumb: { width: 72, height: 72, borderRadius: 12 },
});
