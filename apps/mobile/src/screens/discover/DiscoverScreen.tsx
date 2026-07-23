import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { SearchBar } from '@/components/common/SearchBar';
import { UserCard } from '@/components/common/UserCard';
import { usersApi } from '@/api/users';
import { queryKeys } from '@/constants/queryKeys';
import { useDebounce } from '@/hooks/useDebounce';
import { useDiscover } from '@/hooks/useDiscover';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

export function DiscoverScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 350);

  const location = useQuery({
    queryKey: queryKeys.location,
    queryFn: () => usersApi.getLocation(),
  });

  const params = useMemo(
    () => ({
      q: debounced || undefined,
      lat: location.data?.lat,
      lng: location.data?.lng,
      radiusKm: location.data ? 100 : undefined,
      limit: 20,
    }),
    [debounced, location.data],
  );

  const discover = useDiscover(params);
  const items = discover.data?.pages.flatMap((p) => p.items) ?? [];

  if (location.isLoading) {
    return (
      <Screen>
        <Header title="Discover" />
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    );
  }

  if (!location.data) {
    return (
      <Screen>
        <Header title="Discover" />
        <EmptyState
          title="Share your location"
          description="Enable location to find people and hosts near you."
          actionLabel="Set location"
          onAction={() => nav.navigate('LocationSetup')}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="Discover"
          right={
            <Button
              title="Group call"
              size="sm"
              variant="secondary"
              onPress={() => nav.navigate('GroupCall')}
            />
          }
        />
        <SearchBar value={q} onChangeText={setQ} />
        {discover.isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : discover.isError ? (
          <ErrorView
            message="Could not load people"
            onRetry={() => discover.refetch()}
          />
        ) : (
          <FlashList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <EmptyState title="No matches" description="Try a different search." />
            }
            renderItem={({ item }) => (
              <View style={{ marginBottom: 10 }}>
                <UserCard
                  user={item}
                  onPress={() => nav.navigate('PublicProfile', { userId: item.id })}
                />
              </View>
            )}
            onEndReached={() => {
              if (discover.hasNextPage && !discover.isFetchingNextPage) {
                discover.fetchNextPage();
              }
            }}
            ListFooterComponent={
              discover.isFetchingNextPage ? (
                <ActivityIndicator style={{ marginVertical: 16 }} />
              ) : null
            }
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
