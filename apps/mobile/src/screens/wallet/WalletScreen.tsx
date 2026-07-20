import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/common/Screen';
import { Header } from '@/components/common/Header';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { apiError, paymentsApi, walletApi } from '@/api';
import { queryKeys } from '@/constants/queryKeys';
import { openRazorpayCheckout } from '@/services/razorpay';
import { useAuthStore } from '@/store/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { DiamondPackage, LedgerEntry } from '@/types';
import { formatDiamonds, formatMoney } from '@/utils/format';
import { spacing } from '@/theme';

export function WalletScreen() {
  const c = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upi, setUpi] = useState('');

  const wallet = useQuery({ queryKey: queryKeys.wallet, queryFn: () => walletApi.get() });
  const packages = useQuery({ queryKey: queryKeys.packages, queryFn: () => paymentsApi.packages() });
  const tx = useQuery({
    queryKey: queryKeys.diamondTx(1),
    queryFn: () => walletApi.diamondTransactions({ page: 1, limit: 20 }),
  });

  const pkgRaw = packages.data;
  const pkgList: DiamondPackage[] = Array.isArray(pkgRaw)
    ? pkgRaw
    : (pkgRaw as { items?: DiamondPackage[]; packages?: DiamondPackage[] } | undefined)?.packages ??
      (pkgRaw as { items?: DiamondPackage[] } | undefined)?.items ??
      [];

  const buy = useMutation({
    mutationFn: async (packageId: string) => {
      const order = await paymentsApi.purchase(packageId);
      const keyId = order.keyId ?? order.razorpayKeyId;
      const orderId = order.orderId ?? order.providerOrderId;
      if (!keyId || !orderId || order.amount == null) {
        throw new Error('Payment provider is not configured for this package.');
      }
      const result = await openRazorpayCheckout({
        key: keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Kushlov',
        description: 'Diamond top-up',
        order_id: orderId,
        prefill: { email: user?.email, name: user?.displayName },
      });
      await paymentsApi.verify(order.id, {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      Alert.alert('Success', 'Diamonds added to your wallet.');
    },
    onError: (e) => Alert.alert('Payment', apiError(e)),
  });

  const withdraw = useMutation({
    mutationFn: () =>
      walletApi.withdraw({
        goldAmount: Number(withdrawAmount),
        method: 'upi',
        destination: { upiId: upi },
      }),
    onSuccess: () => {
      Alert.alert('Requested', 'Withdrawal submitted for review.');
      setWithdrawAmount('');
      setUpi('');
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
    onError: (e) => Alert.alert('Withdraw', apiError(e)),
  });

  if (wallet.isLoading || packages.isLoading) {
    return (
      <Screen>
        <Header title="Wallet" />
        <Skeleton height={100} />
        <Skeleton height={160} style={{ marginTop: 16 }} />
      </Screen>
    );
  }

  if (wallet.error) {
    return (
      <Screen>
        <Header title="Wallet" />
        <ErrorView message="Could not load wallet" onRetry={() => wallet.refetch()} />
      </Screen>
    );
  }

  const txItems: LedgerEntry[] = tx.data?.items ?? [];

  return (
    <Screen scroll>
      <Header title="Wallet" />
      <Card style={{ marginBottom: spacing.xl }}>
        <View style={styles.balances}>
          <View>
            <Text muted variant="caption">
              Diamonds
            </Text>
            <Text variant="h1" color={c.primary}>
              {formatDiamonds(wallet.data?.diamonds ?? 0)}
            </Text>
          </View>
          <View>
            <Text muted variant="caption">
              Gold
            </Text>
            <Text variant="h1" color={c.orange}>
              {formatDiamonds(wallet.data?.gold ?? 0)}
            </Text>
          </View>
        </View>
      </Card>

      <Text variant="h3" style={{ marginBottom: spacing.md }}>
        Buy diamonds
      </Text>
      <View style={styles.packages}>
        {pkgList.map((pkg) => (
          <Pressable
            key={pkg.id}
            onPress={() => buy.mutate(pkg.id)}
            disabled={buy.isPending}
            style={[
              styles.pkg,
              { backgroundColor: c.card, borderColor: pkg.popular ? c.primary : c.border },
            ]}
          >
            {pkg.popular ? <Badge label="Popular" tone="pink" /> : null}
            <Text variant="h3" style={{ marginTop: 6 }}>
              {formatDiamonds(pkg.diamonds + (pkg.bonusDiamonds ?? 0))}◆
            </Text>
            <Text muted variant="caption">
              {formatMoney(pkg.priceInr)}
            </Text>
          </Pressable>
        ))}
      </View>
      {pkgList.length === 0 ? (
        <EmptyState title="No packages" description="Diamond packs will appear here." />
      ) : null}

      <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Withdraw gold
      </Text>
      <Input
        label="Amount"
        keyboardType="numeric"
        value={withdrawAmount}
        onChangeText={setWithdrawAmount}
        placeholder="Gold amount"
      />
      <Input
        label="UPI ID"
        value={upi}
        onChangeText={setUpi}
        placeholder="name@upi"
        autoCapitalize="none"
      />
      <Button
        title="Request withdrawal"
        variant="outline"
        onPress={() => withdraw.mutate()}
        loading={withdraw.isPending}
        fullWidth
      />

      <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Recent diamond activity
      </Text>
      <FlashList
        data={txItems}
        scrollEnabled={false}
        ListEmptyComponent={<Text muted>No transactions yet.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.tx, { borderBottomColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold">{String(item.reason ?? 'txn')}</Text>
              <Text muted variant="tiny">
                {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
              </Text>
            </View>
            <Text color={item.direction === 'credit' ? c.success : c.danger}>
              {item.direction === 'credit' ? '+' : '-'}
              {formatDiamonds(Number(item.amount ?? 0))}
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  balances: { flexDirection: 'row', justifyContent: 'space-between' },
  packages: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pkg: {
    width: '47%',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  tx: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
