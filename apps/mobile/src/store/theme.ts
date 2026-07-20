import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export type ThemePreference = 'dark' | 'light' | 'system';

type ThemeState = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  resolved: 'dark' | 'light';
  syncSystem: () => void;
};

function resolve(pref: ThemePreference, system: ColorSchemeName | null | undefined): 'dark' | 'light' {
  if (pref === 'system') return system === 'light' ? 'light' : 'dark';
  return pref;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: 'dark',
      resolved: 'dark',
      setPreference: (preference) =>
        set({
          preference,
          resolved: resolve(preference, Appearance.getColorScheme()),
        }),
      syncSystem: () => {
        const { preference } = get();
        set({ resolved: resolve(preference, Appearance.getColorScheme()) });
      },
    }),
    {
      name: STORAGE_KEYS.theme,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ preference: s.preference }),
      onRehydrateStorage: () => (state) => {
        state?.syncSystem();
      },
    },
  ),
);
