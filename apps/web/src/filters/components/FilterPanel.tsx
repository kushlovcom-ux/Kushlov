'use client';

import { useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { BEAUTY_STEPS, type BeautySettings, type FilterCategory } from '@kushlov/filter-core';
import { cn } from '@/lib/utils';
import { useFilters } from '../hooks/useFilters';

/** Only sliders backed by a real shader uniform are offered. */
const BEAUTY_CONTROLS: { key: keyof BeautySettings; label: string }[] = [
  { key: 'skinSmoothing', label: 'Smooth' },
  { key: 'brightness', label: 'Bright' },
  { key: 'warmth', label: 'Warmth' },
];

function StepRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] font-medium text-white/60">{label}</span>
      <div className="flex flex-1 gap-1">
        {BEAUTY_STEPS.map((step) => {
          const active = Math.abs(value - step) < 0.01;
          return (
            <button
              key={step}
              type="button"
              onClick={() => onChange(step)}
              aria-label={`${label} ${Math.round(step * 100)}%`}
              aria-pressed={active}
              className={cn(
                'h-6 flex-1 rounded-md text-[10px] font-semibold transition',
                active
                  ? 'bg-brand-pink text-white shadow-[0_0_12px_rgba(236,72,153,0.45)]'
                  : 'bg-white/8 text-white/45 hover:bg-white/15',
              )}
            >
              {Math.round(step * 100)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FilterPanel() {
  const {
    categories,
    filters,
    activeFilterId,
    setActiveFilter,
    beauty,
    setBeauty,
    panelOpen,
    setPanelOpen,
  } = useFilters();

  const [category, setCategory] = useState<FilterCategory>('beauty');

  const visible = useMemo(
    () => filters.filter((f) => f.category === category || f.id === 'none'),
    [filters, category],
  );

  const filterActive = activeFilterId !== 'none';

  if (!panelOpen) {
    return (
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        aria-label="Open filters"
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition',
          filterActive
            ? 'border-brand-pink/60 bg-brand-pink/25 text-white shadow-[0_0_16px_rgba(236,72,153,0.4)]'
            : 'border-white/15 bg-black/45 text-white/80 hover:bg-black/60',
        )}
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="w-[min(88vw,20rem)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/85 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Filters
        </span>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          aria-label="Close filters"
          className="rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category rail */}
      <div className="mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories
          .filter((c) => c.id !== 'none')
          .map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition',
                category === c.id
                  ? 'bg-white text-zinc-900'
                  : 'bg-white/8 text-white/55 hover:bg-white/15',
              )}
            >
              {c.label}
            </button>
          ))}
      </div>

      {/* Filter rail */}
      <div className="flex gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((filter) => {
          const selected = filter.id === activeFilterId;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              aria-pressed={selected}
              className="flex w-14 shrink-0 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-xl border text-xl transition',
                  selected
                    ? 'border-brand-pink bg-brand-pink/20 shadow-[0_0_14px_rgba(236,72,153,0.45)]'
                    : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10',
                )}
              >
                {filter.thumbnail}
              </span>
              <span
                className={cn(
                  'w-full truncate text-center text-[10px]',
                  selected ? 'text-white' : 'text-white/50',
                )}
              >
                {filter.name}
              </span>
            </button>
          );
        })}
      </div>

      {category === 'beauty' ? (
        <div className="space-y-1.5 border-t border-white/8 px-3 py-2.5">
          {BEAUTY_CONTROLS.map((control) => (
            <StepRow
              key={control.key}
              label={control.label}
              value={beauty[control.key]}
              onChange={(next) => setBeauty({ [control.key]: next })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
