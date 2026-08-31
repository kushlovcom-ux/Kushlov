import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/common/Screen';
import { UserCard } from '@/components/common/UserCard';
import { SectionHeader } from '@/design-system';
import { useLikes, useMatches } from '@/hooks/useMatches';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

export function MatchesScreen() {
  const c = useThemeColors();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [tab, setTab] = useState('matches');
  const matches = useMatches();
  const likes = useLikes();
  const active = tab === 'matches' ? matches : likes;
  const items = active.data?.items ?? [];

  return (
    <Screen padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Text variant="display">Matches</Text>
        <Text variant="caption" muted style={{ marginTop: 4 }}>
          People who liked you back — spark a conversation.
        </Text>
      </View>
      <View style={{ paddingHorizontal: spacing.screen }}>
        <Tabs
          tabs={[
            { key: 'matches', label: 'Matches' },
            { key: 'likes', label: 'Likes you' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      <ScrollView
        style={{ marginTop: spacing.lg, flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={active.isRefetching} onRefresh={() => active.refetch()} />
        }
      >
        {tab === 'matches' ? (
          <SectionHeader title="Your connections" subtitle={`${items.length} mutual`} flush />
        ) : null}
        {active.isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : active.isError && items.length === 0 ? (
          <ErrorView message="Could not load" onRetry={() => active.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title={tab === 'matches' ? 'No matches yet' : 'No likes yet'}
            description="Like people on Discover to spark a match."
          />
        ) : (
          items.map((u) => (
            <View key={u.id} style={{ marginBottom: spacing.md }}>
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

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
});
