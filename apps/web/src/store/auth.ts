import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser } from '@kushlov/types';

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  hydrated: boolean;
  setAuth: (user: PublicUser, accessToken: string) => void;
  setUser: (user: PublicUser) => void;
  setAccessToken: (token: string) => void;
  clear: () => void;
  setHydrated: () => void;
}

/**
 * Auth store. The access token is kept in memory + persisted to localStorage so
 * requests can attach it; the refresh token lives in an httpOnly cookie only.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      hydrated: false,
      setAuth: (user, accessToken) => set({ user, accessToken }),
      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clear: () => set({ user: null, accessToken: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'kushlov-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
