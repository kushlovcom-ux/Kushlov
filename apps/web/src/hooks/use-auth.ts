'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PublicUser } from '@kushlov/types';
import { api, apiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const res = await api.post('/auth/login', payload);
      return res.data.data as AuthResult;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      toast.success(`Welcome back, ${data.user.displayName}`);
      router.push(data.user.role === 'admin' ? '/admin' : '/discover');
    },
    onError: (err) => toast.error(apiError(err)),
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      username: string;
      displayName: string;
      password: string;
      accountType?: 'user' | 'host';
      country: string;
    }) => {
      const res = await api.post('/auth/register', payload);
      return res.data.data as AuthResult & { accountType?: 'user' | 'host' };
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      const isHost = data.accountType === 'host' || data.user.role === 'host';
      toast.success(isHost ? 'Host account created! Complete verification next.' : 'Account created 🎉');
      router.push(isHost ? '/become-host' : '/discover');
    },
    onError: (err) => toast.error(apiError(err)),
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSettled: () => {
      clear();
      router.push('/login');
    },
  });
}
