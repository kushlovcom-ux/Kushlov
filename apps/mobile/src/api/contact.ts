import { apiGet, apiPost } from './client';
import type { Paginated } from '@/types';

export type ContactInquiry = {
  id: string;
  subject: string;
  category: string;
  message: string;
  status?: string;
  createdAt: string;
};

export const contactApi = {
  submit: (body: {
    subject: string;
    category: 'general' | 'account' | 'billing' | 'host' | 'safety' | 'technical' | 'other';
    message: string;
  }) => apiPost<ContactInquiry>('/contact', body),
  list: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<ContactInquiry>>('/contact', { params }),
};
