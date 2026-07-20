import { apiGet, apiPost } from './client';
import type { LedgerEntry, Paginated, WalletBalance, WithdrawStatus } from '@/types';

export type WithdrawRequest = {
  goldAmount: number;
  method: 'bank_transfer' | 'upi' | 'net_banking';
  destination: Record<string, unknown>;
};

export type Withdrawal = {
  id: string;
  goldAmount: number;
  status: WithdrawStatus | string;
  method: string;
  createdAt: string;
};

export const walletApi = {
  get: () => apiGet<WalletBalance>('/wallet'),
  diamondTransactions: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<LedgerEntry>>('/wallet/diamonds/transactions', { params }),
  goldTransactions: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<LedgerEntry>>('/wallet/gold/transactions', { params }),
  withdraw: (body: WithdrawRequest) => apiPost<Withdrawal>('/wallet/withdraw', body),
  withdrawals: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<Withdrawal>>('/wallet/withdrawals', { params }),
};
