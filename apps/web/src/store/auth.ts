import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser } from '@kushlov/types';

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  sessionChecked: boolean;
  setAuth: (user: PublicUser, accessToken: string, refreshToken?: string | null) => void;
  setUser: (user: PublicUser) => void;
  setAccessToken: (token: string) => void;
  setRefreshToken: (token: string | null) => void;
  clear: () => void;
  setHydrated: () => void;
  setSessionChecked: (checked: boolean) => void;
}

/**
 * Auth store. Access + refresh tokens are persisted so sessions survive reloads.
 * The server also sets an httpOnly refresh cookie when the browser allows it.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      sessionChecked: false,
      setAuth: (user, accessToken, refreshToken = null) =>
        set({ user, accessToken, refreshToken: refreshToken ?? null }),
      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
      setHydrated: () => set({ hydrated: true }),
      setSessionChecked: (sessionChecked) => set({ sessionChecked }),
    }),
    {
      name: 'kushlov-auth',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
