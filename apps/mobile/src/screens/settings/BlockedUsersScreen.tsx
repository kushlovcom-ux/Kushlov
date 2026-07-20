import React from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { UserCard } from '@/components/common/UserCard';
import { getErrorMessage } from '@/api/client';
import { moderationApi } from '@/api/moderation';
import { queryKeys } from '@/constants/queryKeys';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'BlockedUsers'>;

export function BlockedUsersScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const blocks = useQuery({
    queryKey: queryKeys.blocks,
    queryFn: () => moderationApi.listBlocks({ limit: 50 }),
  });
  const unblock = useMutation({
    mutationFn: (id: string) => moderationApi.unblock(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.blocks }),
  });

  const items = blocks.data?.items ?? [];

  return (
    <Screen>
      <Header title="Blocked users" onBack={() => navigation.goBack()} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={blocks.isRefetching} onRefresh={() => blocks.refetch()} />
        }
      >
        {blocks.isLoading ? (
          <SkeletonRow />
        ) : blocks.isError ? (
          <ErrorView message={getErrorMessage(blocks.error)} onRetry={() => blocks.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No blocked users" />
        ) : (
          items.map((u) => (
            <View key={u.id} style={{ marginBottom: spacing.md }}>
              <UserCard user={u} />
              <Button
                title="Unblock"
                size="sm"
                variant="outline"
                style={{ marginTop: 8 }}
                onPress={() => {
                  unblock.mutate(u.id, {
                    onError: (err) => Alert.alert('Error', getErrorMessage(err)),
                  });
                }}
              />
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
