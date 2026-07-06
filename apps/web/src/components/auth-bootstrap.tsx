'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

/** On mount, validate the persisted session by fetching the current user. */
export function AuthBootstrap() {
  const { accessToken, setUser, clear, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) return;
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => clear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return null;
}
