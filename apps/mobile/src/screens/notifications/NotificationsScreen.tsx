import React from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelative } from '@/utils/format';
import { spacing } from '@/theme';
import type { AppStackScreenProps } from '@/navigation/types';

type Props = AppStackScreenProps<'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const { list, markRead, markAllRead } = useNotifications();
  const items = list.data?.items ?? [];

  return (
    <Screen>
      <Header
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          <Button title="Read all" size="sm" variant="ghost" onPress={() => markAllRead.mutate()} />
        }
      />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />
        }
      >
        {list.isLoading ? (
          <SkeletonRow />
        ) : list.isError ? (
          <ErrorView message="Could not load notifications" onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="You're all caught up" />
        ) : (
          items.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => markRead.mutate(n.id)}
              style={{ marginBottom: spacing.lg, opacity: n.readAt ? 0.6 : 1 }}
            >
              <Text variant="bodyBold">{n.title}</Text>
              <Text muted>{n.body}</Text>
              <Text variant="tiny" muted style={{ marginTop: 4 }}>
                {formatRelative(n.createdAt)}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
