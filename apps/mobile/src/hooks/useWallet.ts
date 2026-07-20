import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/api/payments';
import { walletApi } from '@/api/wallet';
import { queryKeys } from '@/constants/queryKeys';
import { openCheckout } from '@/services/razorpay';
import { useAuthStore } from '@/store/auth';

export function useWallet() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const wallet = useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => walletApi.get(),
    enabled: !!token,
  });

  const packages = useQuery({
    queryKey: queryKeys.packages,
    queryFn: async () => {
      const data = await paymentsApi.packages();
      return Array.isArray(data) ? data : data.items ?? [];
    },
    enabled: !!token,
  });

  const diamondTx = useQuery({
    queryKey: queryKeys.diamondTx(1),
    queryFn: () => walletApi.diamondTransactions({ page: 1, limit: 30 }),
    enabled: !!token,
  });

  const purchase = useMutation({
    mutationFn: async (packageId: string) => {
      const order = await paymentsApi.purchase(packageId);
      const key = order.razorpayKeyId || (order as { keyId?: string }).keyId;
      const orderId = order.providerOrderId || (order as { orderId?: string }).orderId;
      if (!key || !orderId) {
        throw new Error('Payment provider is not configured on the server.');
      }
      const result = await openCheckout({
        key,
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: orderId,
        description: 'Diamond pack',
        prefill: {
          email: user?.email,
          name: user?.displayName,
        },
      });
      return paymentsApi.verify(order.id, {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.diamondTx(1) });
    },
  });

  return { wallet, packages, diamondTx, purchase };
}
