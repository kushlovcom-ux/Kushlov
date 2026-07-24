import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FaceFilterId, FaceFilterSettings } from '../types';

const STORAGE_KEY = 'kushlov.faceFilter.settings';

const defaults: FaceFilterSettings = {
  enabled: true,
  lastFilterId: 'none',
  favorites: [],
  beautyDefault: false,
  disableOnLowBattery: true,
};

type FaceFilterStore = {
  hydrated: boolean;
  settings: FaceFilterSettings;
  activeFilterId: FaceFilterId;
  panelOpen: boolean;
  faceDetected: boolean;
  lowBattery: boolean;
  hydrate: () => Promise<void>;
  setActiveFilterId: (id: FaceFilterId) => void;
  toggleFavorite: (id: FaceFilterId) => void;
  setEnabled: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  setFaceDetected: (v: boolean) => void;
  setLowBattery: (v: boolean) => void;
};

async function persist(settings: FaceFilterSettings) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export const useFaceFilterStore = create<FaceFilterStore>((set, get) => ({
  hydrated: false,
  settings: defaults,
  activeFilterId: 'none',
  panelOpen: false,
  faceDetected: true,
  lowBattery: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = { ...defaults, ...JSON.parse(raw) } as FaceFilterSettings;
        const id =
          parsed.beautyDefault && parsed.lastFilterId === 'none'
            ? 'beauty'
            : parsed.lastFilterId;
        set({ settings: parsed, activeFilterId: id, hydrated: true });
        return;
      }
    } catch {
      /* ignore */
    }
    set({ hydrated: true });
  },
  setActiveFilterId: (id) => {
    const settings = { ...get().settings, lastFilterId: id };
    set({ activeFilterId: id, settings });
    void persist(settings);
  },
  toggleFavorite: (id) => {
    const prev = get().settings;
    const has = prev.favorites.includes(id);
    const favorites = has
      ? prev.favorites.filter((f) => f !== id)
      : [...prev.favorites, id];
    const settings = { ...prev, favorites };
    set({ settings });
    void persist(settings);
  },
  setEnabled: (enabled) => {
    const settings = { ...get().settings, enabled };
    set({
      settings,
      activeFilterId: enabled ? get().activeFilterId : 'none',
    });
    void persist(settings);
  },
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setFaceDetected: (faceDetected) => set({ faceDetected }),
  setLowBattery: (lowBattery) => set({ lowBattery }),
}));

/** Effective filter after settings / battery gates. */
export function selectEffectiveFilterId(s: FaceFilterStore): FaceFilterId {
  if (!s.settings.enabled) return 'none';
  if (s.settings.disableOnLowBattery && s.lowBattery) return 'none';
  return s.activeFilterId;
}
