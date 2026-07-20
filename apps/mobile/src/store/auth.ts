import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PublicUser } from '@/types';
import { STORAGE_KEYS } from '@/constants/storageKeys';

/**
 * Auth persistence uses AsyncStorage (not SecureStore).
 * Android SecureStore has a ~2048 byte limit — storing user + tokens there
 * silently fails / can leave the app stuck on a blank splash after install.
 */

export type AuthState = {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  rememberMe: boolean;
  hydrated: boolean;
  onboardingSeen: boolean;
  setHydrated: (v: boolean) => void;
  setOnboardingSeen: (v: boolean) => void;
  setAuth: (payload: {
    user: PublicUser;
    accessToken: string;
    refreshToken: string;
    rememberMe?: boolean;
  }) => void;
  setUser: (user: PublicUser | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      rememberMe: true,
      hydrated: false,
      onboardingSeen: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setOnboardingSeen: (onboardingSeen) => set({ onboardingSeen }),
      setAuth: ({ user, accessToken, refreshToken, rememberMe }) =>
        set({
          user,
          accessToken,
          refreshToken,
          rememberMe: rememberMe ?? true,
        }),
      setUser: (user) => set({ user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      clear: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        }),
    }),
    {
      name: STORAGE_KEYS.auth,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        user: s.rememberMe ? s.user : null,
        accessToken: s.rememberMe ? s.accessToken : null,
        refreshToken: s.rememberMe ? s.refreshToken : null,
        rememberMe: s.rememberMe,
        onboardingSeen: s.onboardingSeen,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // Never block UI if storage rehydrate fails
          useAuthStore.getState().setHydrated(true);
          return;
        }
        state?.setHydrated(true);
      },
    },
  ),
);

// Safety: if rehydrate never completes, unblock UI after 2s
setTimeout(() => {
  const s = useAuthStore.getState();
  if (!s.hydrated) s.setHydrated(true);
}, 2000);
