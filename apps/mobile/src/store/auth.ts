import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import type { PublicUser } from '@/types';
import { STORAGE_KEYS } from '@/constants/storageKeys';

const secureStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // SecureStore unavailable (web/simulator edge cases)
    }
  },
  removeItem: async (name) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // ignore
    }
  },
};

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
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        rememberMe: s.rememberMe,
        onboardingSeen: s.onboardingSeen,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
