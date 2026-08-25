import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FaceBox, FaceFilterId, FaceFilterSettings } from '../types';

const STORAGE_KEY = 'kushlov.faceFilter.settings';

const defaults: FaceFilterSettings = {
  enabled: true,
  lastFilterId: 'none',
  favorites: [],
  beautyDefault: false,
  disableOnLowBattery: false,
};

type FaceFilterStore = {
  hydrated: boolean;
  settings: FaceFilterSettings;
  activeFilterId: FaceFilterId;
  panelOpen: boolean;
  faceDetected: boolean;
  lowBattery: boolean;
  /** identity → filter id from LiveKit attributes / data packets */
  remoteFilters: Record<string, string>;
  remoteBoxes: Record<string, FaceBox>;
  hydrate: () => Promise<void>;
  setActiveFilterId: (id: FaceFilterId) => void;
  toggleFavorite: (id: FaceFilterId) => void;
  setEnabled: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  setFaceDetected: (v: boolean) => void;
  setLowBattery: (v: boolean) => void;
  setRemoteFilter: (identity: string, id: string, box?: FaceBox | null) => void;
  clearRemoteFilters: () => void;
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
  remoteFilters: {},
  remoteBoxes: {},
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
    const prev = get().settings;
    const settings = {
      ...prev,
      lastFilterId: id,
      enabled: id === 'none' ? prev.enabled : true,
    };
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
  setRemoteFilter: (identity, id, box) => {
    const key = String(identity || '');
    if (!key) return;
    const next = id && id !== 'none' ? id : '';
    set((s) => {
      const prevId = s.remoteFilters[key] ?? '';
      const prevBox = s.remoteBoxes[key];
      const boxSame =
        !box ||
        (prevBox &&
          prevBox.cx === box.cx &&
          prevBox.cy === box.cy &&
          prevBox.width === box.width &&
          prevBox.height === box.height);
      if (prevId === next && boxSame) return s;
      const remoteFilters = { ...s.remoteFilters };
      const remoteBoxes = { ...s.remoteBoxes };
      if (next) remoteFilters[key] = next;
      else delete remoteFilters[key];
      if (next && box) remoteBoxes[key] = box;
      else if (!next) delete remoteBoxes[key];
      return { remoteFilters, remoteBoxes };
    });
  },
  clearRemoteFilters: () => set({ remoteFilters: {}, remoteBoxes: {} }),
}));

/** Effective filter after settings / battery gates. */
export function selectEffectiveFilterId(s: FaceFilterStore): FaceFilterId {
  if (!s.settings.enabled) return 'none';
  if (s.settings.disableOnLowBattery && s.lowBattery) return 'none';
  return s.activeFilterId;
}
