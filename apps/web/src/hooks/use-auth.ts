'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PublicUser } from '@kushlov/types';
import { DEFAULT_COUNTRY } from '@kushlov/utils';
import { api, apiError } from '@/lib/api';
import { signInWithGooglePopup, signOutFirebase } from '@/lib/firebase-auth';
import { useAuthStore } from '@/store/auth';

interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  token?: string;
}

function redirectAfterLogin(router: ReturnType<typeof useRouter>, user: PublicUser) {
  const next =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
  if (next && next.startsWith('/')) {
    router.push(next);
  } else {
    router.push(user.role === 'admin' ? '/admin' : '/discover');
  }
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
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome back, ${data.user.displayName}`);
      redirectAfterLogin(router, data.user);
    },
    onError: (err) => toast.error(apiError(err)),
  });
}

export function useGoogleLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const idToken = await signInWithGooglePopup();
      const res = await api.post('/auth/google', {
        idToken,
        country: user?.country ?? DEFAULT_COUNTRY,
      });
      return res.data.data as AuthResult;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome, ${data.user.displayName}`);
      redirectAfterLogin(router, data.user);
    },
    onError: (err: unknown) => {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        toast.message('Google sign-in cancelled');
        return;
      }
      if (code === 'auth/network-request-failed') {
        toast.error('Network error. Check your connection and try again.');
        return;
      }
      toast.error(apiError(err));
    },
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
      setAuth(data.user, data.accessToken, data.refreshToken);
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
      await signOutFirebase();
      await api.post('/auth/logout');
    },
    onSettled: () => {
      clear();
      router.push('/login');
    },
  });
}
