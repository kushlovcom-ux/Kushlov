'use client';

import { formatMoney } from '@kushlov/utils';
import { useAuthStore } from '@/store/auth';

/** Format prices as ₹ for India, $ for all other countries. */
export function useFormatMoney() {
  const country = useAuthStore((s) => s.user?.country);
  return (value: number) => formatMoney(value, country);
}
