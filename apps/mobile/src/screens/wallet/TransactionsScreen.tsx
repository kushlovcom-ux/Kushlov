import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '@/components/ui/Text';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { walletApi } from '@/api/wallet';
import { getErrorMessage } from '@/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { formatDateTime } from '@/utils/format';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Transactions'>;

export function TransactionsScreen({ navigation }: Props) {
  const [tab, setTab] = useState('diamonds');
  const diamonds = useQuery({
    queryKey: queryKeys.diamondTx(1),
    queryFn: () => walletApi.diamondTransactions({ page: 1, limit: 50 }),
  });
  const gold = useQuery({
    queryKey: queryKeys.goldTx(1),
    queryFn: () => walletApi.goldTransactions({ page: 1, limit: 50 }),
  });
  const active = tab === 'diamonds' ? diamonds : gold;
  const items = active.data?.items ?? [];

  return (
    <Screen>
      <Header title="Transactions" onBack={() => navigation.goBack()} />
      <Tabs
        tabs={[
          { key: 'diamonds', label: 'Diamonds' },
          { key: 'gold', label: 'Gold' },
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
          <SkeletonRow />
        ) : active.isError ? (
          <ErrorView message={getErrorMessage(active.error)} onRetry={() => active.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No transactions" />
        ) : (
          items.map((t) => (
            <View key={t.id} style={{ marginBottom: spacing.md }}>
              <Text variant="bodyBold">
                {t.direction === 'credit' ? '+' : '-'}
                {t.amount} · {t.reason}
              </Text>
              <Text muted variant="caption">
                {formatDateTime(t.createdAt)} · bal {t.balanceAfter}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
