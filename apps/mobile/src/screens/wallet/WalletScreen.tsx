import React, { useCallback, useMemo, useState } from 'react';
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
import { Chip, GlassCard, PressableScale, SectionHeader } from '@/design-system';
import { apiError, paymentsApi, walletApi } from '@/api';
import { queryKeys } from '@/constants/queryKeys';
import { openRazorpayCheckout } from '@/services/razorpay';
import { useAuthStore } from '@/store/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Role, type DiamondPackage, type LedgerEntry } from '@/types';
import { formatDiamonds, formatMoney } from '@/utils/format';
import { radius, spacing } from '@/theme';

const WITHDRAW_METHODS = [
  { id: 'upi', label: 'UPI' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'net_banking', label: 'Net Banking' },
] as const;

type WithdrawMethod = (typeof WITHDRAW_METHODS)[number]['id'];

export function WalletScreen() {
  const c = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [method, setMethod] = useState<WithdrawMethod>('upi');
  const [dest, setDest] = useState({
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
    upiId: '',
  });
  const canUseGold =
    user?.role === Role.Host || user?.role === Role.Admin || Boolean(user?.isHostApproved);

  const wallet = useQuery({ queryKey: queryKeys.wallet, queryFn: () => walletApi.get() });
  const packages = useQuery({
    queryKey: queryKeys.packages,
    queryFn: async () => {
      const data = await paymentsApi.packages();
      if (Array.isArray(data)) return data;
      return data.packages ?? [];
    },
  });
  const tx = useQuery({
    queryKey: queryKeys.diamondTx(1),
    queryFn: () => walletApi.diamondTransactions({ page: 1, limit: 20 }),
  });

  const pkgList: DiamondPackage[] = packages.data ?? [];

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

  const destination = useMemo(() => {
    if (method === 'upi') {
      return {
        accountHolder: dest.accountHolder.trim(),
        upiId: dest.upiId.trim(),
      };
    }
    return {
      accountHolder: dest.accountHolder.trim(),
      bankName: dest.bankName.trim(),
      accountNumber: dest.accountNumber.trim(),
      ifsc: dest.ifsc.trim().toUpperCase(),
    };
  }, [dest, method]);

  const withdraw = useMutation({
    mutationFn: () => {
      const goldAmount = Number(withdrawAmount);
      if (!Number.isFinite(goldAmount) || goldAmount <= 0) {
        throw new Error('Enter a valid gold amount.');
      }
      if (!dest.accountHolder.trim()) {
        throw new Error('Enter the account holder name.');
      }
      if (method === 'upi' && !dest.upiId.trim()) {
        throw new Error('Enter your UPI ID.');
      }
      if (method !== 'upi') {
        if (!dest.bankName.trim() || !dest.accountNumber.trim() || !dest.ifsc.trim()) {
          throw new Error('Enter bank name, account number, and IFSC.');
        }
      }
      return walletApi.withdraw({
        goldAmount,
        method,
        destination,
      });
    },
    onSuccess: () => {
      Alert.alert('Requested', 'Withdrawal submitted for review.');
      setWithdrawAmount('');
      setDest({
        accountHolder: '',
        accountNumber: '',
        ifsc: '',
        bankName: '',
        upiId: '',
      });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
    onError: (e) => Alert.alert('Withdraw', apiError(e)),
  });

  const onRefresh = useCallback(async () => {
    await Promise.all([wallet.refetch(), packages.refetch(), tx.refetch()]);
  }, [wallet, packages, tx]);

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
    <Screen scroll padded={false} onRefresh={onRefresh}>
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
                {formatDiamonds(pkg.diamonds + (pkg.bonusDiamonds ?? pkg.bonus ?? 0))}◆
              </Text>
              <Text muted variant="caption">
                {formatMoney(pkg.price ?? pkg.priceInr ?? pkg.priceUsd ?? 0, pkg.currency ?? 'INR')}
              </Text>
            </PressableScale>
          ))}
        </View>
        {pkgList.length === 0 ? (
          <EmptyState title="No packages" description="Diamond packs will appear here." />
        ) : null}

        {canUseGold ? (
          <>
            <SectionHeader
              title="Withdraw gold"
              subtitle="UPI, bank transfer, or net banking"
              flush
            />
            <GlassCard style={{ marginBottom: spacing.lg }}>
              <Text variant="captionBold" muted style={{ marginBottom: spacing.sm }}>
                Payout method
              </Text>
              <View style={styles.methodRow}>
                {WITHDRAW_METHODS.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.label}
                    selected={method === m.id}
                    onPress={() => setMethod(m.id)}
                  />
                ))}
              </View>

              <View style={{ height: spacing.md }} />
              <Input
                label="Amount (gold)"
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="Gold amount"
              />
              <View style={{ height: spacing.md }} />
              <Input
                label="Account holder name"
                value={dest.accountHolder}
                onChangeText={(v) => setDest((d) => ({ ...d, accountHolder: v }))}
                placeholder="Name on account"
                autoCapitalize="words"
              />

              {method === 'upi' ? (
                <>
                  <View style={{ height: spacing.md }} />
                  <Input
                    label="UPI ID"
                    value={dest.upiId}
                    onChangeText={(v) => setDest((d) => ({ ...d, upiId: v }))}
                    placeholder="name@upi"
                    autoCapitalize="none"
                  />
                </>
              ) : (
                <>
                  <View style={{ height: spacing.md }} />
                  <Input
                    label="Bank name"
                    value={dest.bankName}
                    onChangeText={(v) => setDest((d) => ({ ...d, bankName: v }))}
                    placeholder="Bank name"
                  />
                  <View style={{ height: spacing.md }} />
                  <Input
                    label="Account number"
                    value={dest.accountNumber}
                    onChangeText={(v) => setDest((d) => ({ ...d, accountNumber: v }))}
                    placeholder="Account number"
                    keyboardType="number-pad"
                  />
                  <View style={{ height: spacing.md }} />
                  <Input
                    label="IFSC code"
                    value={dest.ifsc}
                    onChangeText={(v) => setDest((d) => ({ ...d, ifsc: v.toUpperCase() }))}
                    placeholder="IFSC"
                    autoCapitalize="characters"
                  />
                </>
              )}

              <View style={{ height: spacing['2xl'] }} />
              <Button
                title="Request withdrawal"
                variant="primary"
                onPress={() => withdraw.mutate()}
                loading={withdraw.isPending}
                fullWidth
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
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
