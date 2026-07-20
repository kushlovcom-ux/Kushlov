import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { UserCard } from '@/components/common/UserCard';
import { useLikes, useMatches } from '@/hooks/useMatches';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

export function MatchesScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [tab, setTab] = useState('matches');
  const matches = useMatches();
  const likes = useLikes();
  const active = tab === 'matches' ? matches : likes;
  const items = active.data?.items ?? [];

  return (
    <Screen>
      <Header title="Matches" onBack={() => nav.goBack()} />
      <Tabs
        tabs={[
          { key: 'matches', label: 'Matches' },
          { key: 'likes', label: 'Likes you' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView
        style={{ marginTop: spacing.lg }}
        refreshControl={
          <RefreshControl refreshing={active.isRefetching} onRefresh={() => active.refetch()} />
        }
      >
        {active.isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : active.isError ? (
          <ErrorView message="Could not load" onRetry={() => active.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title={tab === 'matches' ? 'No matches yet' : 'No likes yet'}
            description="Like people on Discover to spark a match."
          />
        ) : (
          items.map((u) => (
            <View key={u.id} style={{ marginBottom: 10 }}>
              <UserCard
                user={u}
                onPress={() => nav.navigate('PublicProfile', { userId: u.id })}
              />
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
