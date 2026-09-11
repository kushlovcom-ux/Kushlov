'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_BEAUTY,
  clampBeauty,
  isBeautyActive,
  type BeautySettings,
  type FilterCategorySummary,
  type FilterDefinition,
  type FilterEngineStatus,
} from '@kushlov/filter-core';
import { WEB_REGISTRY, WebFilterEngine } from '../engine/WebFilterEngine';

const STORAGE_KEY = 'kushlov.filters.v1';

type Persisted = {
  filterId: string;
  beauty: BeautySettings;
};

function load(): Persisted {
  const fallback: Persisted = { filterId: 'none', beauty: { ...DEFAULT_BEAUTY } };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const filterId =
      typeof parsed.filterId === 'string' && WEB_REGISTRY.has(parsed.filterId)
        ? parsed.filterId
        : 'none';
    return { filterId, beauty: clampBeauty(parsed.beauty ?? {}) };
  } catch {
    return fallback;
  }
}

function save(value: Persisted): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* private mode or a full quota must not break the call */
  }
}

type FiltersContextValue = {
  engine: WebFilterEngine | null;
  categories: FilterCategorySummary[];
  filters: FilterDefinition[];
  activeFilterId: string;
  activeFilter: FilterDefinition | null;
  setActiveFilter: (id: string) => void;
  beauty: BeautySettings;
  setBeauty: (patch: Partial<BeautySettings>) => void;
  /** True when the engine has anything to do — drives processor attachment. */
  processingWanted: boolean;
  status: FilterEngineStatus;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
};

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [engine, setEngine] = useState<WebFilterEngine | null>(null);
  const [status, setStatus] = useState<FilterEngineStatus>('idle');
  const [activeFilterId, setActiveFilterId] = useState('none');
  const [beauty, setBeautyState] = useState<BeautySettings>({ ...DEFAULT_BEAUTY });
  const [panelOpen, setPanelOpen] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    const instance = new WebFilterEngine({ onStatus: setStatus });
    setEngine(instance);
    return () => {
      void instance.destroy();
    };
  }, []);

  // Restore after mount so the server and first client render agree.
  useEffect(() => {
    const persisted = load();
    hydrated.current = true;
    setActiveFilterId(persisted.filterId);
    setBeautyState(persisted.beauty);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    save({ filterId: activeFilterId, beauty });
  }, [activeFilterId, beauty]);

  const setActiveFilter = useCallback((id: string) => {
    setActiveFilterId(WEB_REGISTRY.has(id) ? id : 'none');
  }, []);

  const setBeauty = useCallback((patch: Partial<BeautySettings>) => {
    setBeautyState((prev) => clampBeauty({ ...prev, ...patch }));
  }, []);

  const activeFilter = useMemo(() => WEB_REGISTRY.get(activeFilterId), [activeFilterId]);
  const categories = useMemo(() => WEB_REGISTRY.categories(), []);
  const filters = useMemo(() => WEB_REGISTRY.all(), []);

  const processingWanted =
    (activeFilter !== null && activeFilter.kind !== 'none') || isBeautyActive(beauty);

  const value = useMemo<FiltersContextValue>(
    () => ({
      engine,
      categories,
      filters,
      activeFilterId,
      activeFilter,
      setActiveFilter,
      beauty,
      setBeauty,
      processingWanted,
      status,
      panelOpen,
      setPanelOpen,
    }),
    [
      engine,
      categories,
      filters,
      activeFilterId,
      activeFilter,
      setActiveFilter,
      beauty,
      setBeauty,
      processingWanted,
      status,
      panelOpen,
    ],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used inside <FiltersProvider>');
  return ctx;
}

/** For components that render both inside and outside a filtered room. */
export function useFiltersOptional(): FiltersContextValue | null {
  return useContext(FiltersContext);
}
