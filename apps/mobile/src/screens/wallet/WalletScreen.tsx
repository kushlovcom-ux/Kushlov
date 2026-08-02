import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/common/Screen';
import { Header } from '@/components/common/Header';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { GlassCard, PressableScale, SectionHeader } from '@/design-system';
import { apiError, paymentsApi, walletApi } from '@/api';
import { queryKeys } from '@/constants/queryKeys';
import { openRazorpayCheckout } from '@/services/razorpay';
import { useAuthStore } from '@/store/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Role, type DiamondPackage, type LedgerEntry } from '@/types';
import { formatDiamonds, formatMoney } from '@/utils/format';
import { radius, spacing } from '@/theme';

export function WalletScreen() {
  const c = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upi, setUpi] = useState('');
  const canUseGold =
    user?.role === Role.Host || user?.role === Role.Admin || Boolean(user?.isHostApproved);

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
        <Header title="Wallet" showBack />
        <Skeleton height={100} />
        <Skeleton height={160} style={{ marginTop: 16 }} />
      </Screen>
    );
  }

  if (wallet.error) {
    return (
      <Screen>
        <Header title="Wallet" showBack />
        <ErrorView message="Could not load wallet" onRetry={() => wallet.refetch()} />
      </Screen>
    );
  }

  const txItems: LedgerEntry[] = tx.data?.items ?? [];

  return (
    <Screen scroll padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <View style={styles.pad}>
        <Header title="Wallet" showBack />

        <LinearGradient
          colors={[...c.gradientVip]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <Ionicons name="diamond" size={22} color="#1A1208" />
            <Text variant="captionBold" color="#1A1208">
              Kushlov Wallet
            </Text>
          </View>
          <View style={styles.balances}>
            <View>
              <Text variant="caption" color="rgba(26,18,8,0.7)">
                Diamonds
              </Text>
              <Text variant="display" color="#1A1208">
                {formatDiamonds(wallet.data?.diamonds ?? 0)}
              </Text>
            </View>
            {canUseGold ? (
              <View>
                <Text variant="caption" color="rgba(26,18,8,0.7)">
                  Gold
                </Text>
                <Text variant="display" color="#1A1208">
                  {formatDiamonds(wallet.data?.gold ?? 0)}
                </Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <SectionHeader title="Buy diamonds" subtitle="Instant top-up via Razorpay" flush />
        <View style={styles.packages}>
          {pkgList.map((pkg) => (
            <PressableScale
              key={pkg.id}
              onPress={() => buy.mutate(pkg.id)}
              disabled={buy.isPending}
              style={[
                styles.pkg,
                {
                  backgroundColor: c.card,
                  borderColor: pkg.popular ? c.premiumGold : c.border,
                },
              ]}
            >
              {pkg.popular ? <Badge label="Popular" tone="orange" /> : null}
              <Text variant="h3" style={{ marginTop: 6 }}>
                {formatDiamonds(pkg.diamonds + (pkg.bonusDiamonds ?? 0))}◆
              </Text>
              <Text muted variant="caption">
                {formatMoney(pkg.priceInr ?? 0)}
              </Text>
            </PressableScale>
          ))}
        </View>
        {pkgList.length === 0 ? (
          <EmptyState title="No packages" description="Diamond packs will appear here." />
        ) : null}

        {canUseGold ? (
          <>
            <SectionHeader title="Withdraw gold" subtitle="UPI payouts after review" flush />
            <GlassCard style={{ marginBottom: spacing.lg }}>
              <Input
                label="Amount"
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="Gold amount"
              />
              <View style={{ height: spacing.md }} />
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
                style={{ marginTop: spacing.lg }}
              />
            </GlassCard>
          </>
        ) : null}

        <SectionHeader title="Recent activity" flush />
        <FlashList
          data={txItems}
          scrollEnabled={false}
          ListEmptyComponent={<Text muted>No transactions yet.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.tx, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyBold">{String(item.reason ?? 'txn')}</Text>
                <Text muted variant="caption">
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen, paddingBottom: spacing['4xl'] },
  hero: {
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg },
  balances: { flexDirection: 'row', justifyContent: 'space-between' },
  packages: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  pkg: {
    width: '47%',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
  },
  tx: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
});
