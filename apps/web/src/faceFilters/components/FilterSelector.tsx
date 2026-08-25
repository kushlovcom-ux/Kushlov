'use client';

import { useMemo, useState } from 'react';
import { Sparkles, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FACE_FILTER_CATALOG, FILTER_CATEGORIES } from '../catalog';
import { useFaceFilter } from '../hooks/useFaceFilter';
import type { FaceFilterCategory, FaceFilterId } from '../types';

/** Side panel filter picker (web). */
export function FilterSelector({ className }: { className?: string }) {
  const {
    activeFilterId,
    setActiveFilterId,
    toggleFavorite,
    settings,
    panelOpen,
    setPanelOpen,
    faceDetected,
    setEnabled,
  } = useFaceFilter();
  const [category, setCategory] = useState<FaceFilterCategory>('trending');

  const items = useMemo(() => {
    if (category === 'trending') {
      return FACE_FILTER_CATALOG.filter(
        (f) => f.id === 'none' || settings.favorites.includes(f.id) || f.category === 'trending',
      );
    }
    return FACE_FILTER_CATALOG.filter((f) => f.category === category || f.id === 'none');
  }, [category, settings.favorites]);

  if (!panelOpen) {
    return (
      <Button
        type="button"
        size="sm"
        className={cn('gap-1', className)}
        onClick={() => setPanelOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Filters
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'flex max-h-72 w-full flex-col gap-2 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Face filters</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={settings.enabled ? 'secondary' : 'destructive'}
            className="h-7 text-[10px]"
            onClick={() => setEnabled(!settings.enabled)}
          >
            {settings.enabled ? 'On' : 'Off'}
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPanelOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {!faceDetected && activeFilterId !== 'none' && !String(activeFilterId).startsWith('bg') ? (
        <p className="text-center text-[11px] text-amber-300">Face not detected — retrying…</p>
      ) : null}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTER_CATEGORIES.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={category === c.id ? 'default' : 'secondary'}
            className="h-7 shrink-0 px-2 text-[10px]"
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </Button>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 pt-1">
        {items.map((f) => {
          const on = activeFilterId === f.id;
          const fav = settings.favorites.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              title={f.name}
              onClick={() => {
                setActiveFilterId(f.id as FaceFilterId);
                setPanelOpen(false);
              }}
              className="relative flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full border text-2xl transition',
                  on
                    ? 'scale-110 border-2 border-white bg-brand-pink/80'
                    : 'border-white/25 bg-black/50',
                )}
              >
                {f.id === 'none' ? '✕' : f.emoji}
              </span>
              <span className="line-clamp-1 w-16 text-center text-[9px] text-white/70">{f.name}</span>
              {f.id !== 'none' ? (
                <button
                  type="button"
                  className="absolute right-0 top-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(f.id as FaceFilterId);
                  }}
                  aria-label="Favorite"
                >
                  <Star
                    className={cn('h-3 w-3', fav ? 'fill-amber-400 text-amber-400' : 'text-white/30')}
                  />
                </button>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
