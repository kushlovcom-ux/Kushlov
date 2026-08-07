import { apiGet, apiPost } from './client';
import type { DiamondPackage, Paginated, PaymentOrder } from '@/types';

export type PackagesResponse = {
  packages: DiamondPackage[];
  provider?: string;
  razorpayKeyId?: string | null;
};

export const paymentsApi = {
  packages: () => apiGet<PackagesResponse | DiamondPackage[]>('/payments/packages'),
  purchase: (packageId: string) =>
    apiPost<PaymentOrder & { orderId?: string; keyId?: string; amount?: number }>(
      '/payments/purchase',
      { packageId },
    ),
  verify: (
    paymentId: string,
    body?: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
  ) => apiPost<PaymentOrder>(`/payments/${paymentId}/verify`, body ?? {}),
  list: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<PaymentOrder>>('/payments', { params }),
};
