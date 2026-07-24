'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { FaceFilterId, FaceFilterSettings } from '../types';

const STORAGE_KEY = 'kushlov.faceFilter.settings';

const defaults: FaceFilterSettings = {
  enabled: true,
  lastFilterId: 'none',
  favorites: [],
  beautyDefault: false,
  disableOnLowBattery: true,
};

function loadSettings(): FaceFilterSettings {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

function saveSettings(s: FaceFilterSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

type Ctx = {
  settings: FaceFilterSettings;
  activeFilterId: FaceFilterId;
  setActiveFilterId: (id: FaceFilterId) => void;
  toggleFavorite: (id: FaceFilterId) => void;
  setEnabled: (v: boolean) => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  faceDetected: boolean;
  setFaceDetected: (v: boolean) => void;
};

const FaceFilterContext = createContext<Ctx | null>(null);

export function FaceFilterProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FaceFilterSettings>(defaults);
  const [activeFilterId, setActiveFilterIdState] = useState<FaceFilterId>('none');
  const [panelOpen, setPanelOpen] = useState(false);
  const [faceDetected, setFaceDetected] = useState(true);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setActiveFilterIdState(s.beautyDefault && s.lastFilterId === 'none' ? 'beauty' : s.lastFilterId);
  }, []);

  const setActiveFilterId = useCallback((id: FaceFilterId) => {
    setActiveFilterIdState(id);
    setSettings((prev) => {
      const next = { ...prev, lastFilterId: id };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: FaceFilterId) => {
    setSettings((prev) => {
      const has = prev.favorites.includes(id);
      const favorites = has
        ? prev.favorites.filter((f) => f !== id)
        : [...prev.favorites, id];
      const next = { ...prev, favorites };
      saveSettings(next);
      return next;
    });
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, enabled };
      saveSettings(next);
      return next;
    });
    if (!enabled) setActiveFilterIdState('none');
  }, []);

  const value = useMemo(
    () => ({
      settings,
      activeFilterId: settings.enabled ? activeFilterId : 'none',
      setActiveFilterId,
      toggleFavorite,
      setEnabled,
      panelOpen,
      setPanelOpen,
      faceDetected,
      setFaceDetected,
    }),
    [
      settings,
      activeFilterId,
      setActiveFilterId,
      toggleFavorite,
      setEnabled,
      panelOpen,
      faceDetected,
    ],
  );

  return <FaceFilterContext.Provider value={value}>{children}</FaceFilterContext.Provider>;
}

export function useFaceFilter() {
  const ctx = useContext(FaceFilterContext);
  if (!ctx) throw new Error('useFaceFilter must be used within FaceFilterProvider');
  return ctx;
}

/** Safe hook when provider may be absent (returns null). */
export function useFaceFilterOptional() {
  return useContext(FaceFilterContext);
}
