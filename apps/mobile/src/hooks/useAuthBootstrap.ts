import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '@/api';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { useAuthStore } from '@/store/auth';

export function useAuthBootstrap() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.onboardingDone).then((v) => {
      setOnboardingDone(v === '1');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!hydrated || onboardingDone === null) return;
      if (!accessToken) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken, onboardingDone, setUser, clear]);

  return {
    ready: ready && hydrated && onboardingDone !== null,
    isAuthenticated: Boolean(accessToken),
    onboardingDone: onboardingDone === true,
    markOnboardingDone: async () => {
      await AsyncStorage.setItem(STORAGE_KEYS.onboardingDone, '1');
      setOnboardingDone(true);
    },
  };
}
