import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { callsApi } from '@/api/calls';
import { getErrorMessage } from '@/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { formatDateTime, formatDuration } from '@/utils/format';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CallHistory' | 'History'>;

export function CallHistoryScreen({ navigation }: Props) {
  const history = useQuery({
    queryKey: queryKeys.callHistory,
    queryFn: () => callsApi.history({ limit: 50 }),
  });
  const items = history.data?.items ?? [];

  return (
    <Screen>
      <Header title="Call history" onBack={() => navigation.goBack()} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={history.isRefetching} onRefresh={() => history.refetch()} />
        }
      >
        {history.isLoading ? (
          <SkeletonRow />
        ) : history.isError ? (
          <ErrorView message={getErrorMessage(history.error)} onRetry={() => history.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No calls yet" />
        ) : (
          items.map((call) => {
            const peer = call.caller?.id === call.calleeId ? call.caller : call.callee ?? call.caller;
            return (
              <View key={call.id} style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text variant="bodyBold">{peer?.displayName ?? 'Call'}</Text>
                  <Badge label={call.type} tone="purple" />
                  <Badge label={call.status} tone="muted" />
                </View>
                <Text muted variant="caption">
                  {formatDateTime(call.createdAt)}
                  {call.durationSec != null ? ` · ${formatDuration(call.durationSec)}` : ''}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
