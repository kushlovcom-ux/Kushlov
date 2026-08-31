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
import { useAuthStore } from '@/store/auth';
import { formatDateTime, formatDuration } from '@/utils/format';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';
import type { CallSession, PublicUser } from '@/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CallHistory' | 'History'>;

function peerForCall(call: CallSession, myId?: string): PublicUser | undefined {
  if (!myId) return call.callee ?? call.caller;
  const iAmCaller = call.callerId === myId || call.caller?.id === myId;
  if (iAmCaller) return call.callee ?? call.caller;
  return call.caller ?? call.callee;
}

function directionLabel(call: CallSession, myId?: string): string {
  if (!myId) return 'Call';
  const iAmCaller = call.callerId === myId || call.caller?.id === myId;
  return iAmCaller ? 'Outgoing' : 'Incoming';
}

export function CallHistoryScreen({ navigation }: Props) {
  const myId = useAuthStore((s) => s.user?.id);
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
        ) : history.isError && items.length === 0 ? (
          <ErrorView message={getErrorMessage(history.error)} onRetry={() => history.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No calls yet" />
        ) : (
          items.map((call) => {
            const peer = peerForCall(call, myId);
            const name =
              peer?.displayName || peer?.username || 'Unknown';
            return (
              <View key={call.id} style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text variant="bodyBold">{name}</Text>
                  <Badge label={directionLabel(call, myId)} tone="muted" />
                  <Badge label={String(call.type)} tone="purple" />
                  <Badge label={String(call.status)} tone="muted" />
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
