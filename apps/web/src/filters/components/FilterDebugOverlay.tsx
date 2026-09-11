'use client';

import { useEffect, useState } from 'react';
import type { FilterEngineStats } from '../engine/WebFilterEngine';
import { useFilters } from '../hooks/useFilters';

/** Never ships to users: the whole component compiles out of production. */
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

export function FilterDebugOverlay() {
  const { engine, status } = useFilters();
  const [stats, setStats] = useState<FilterEngineStats | null>(null);

  useEffect(() => {
    if (!DEBUG_ENABLED || !engine) return;
    const id = window.setInterval(() => setStats(engine.getStats()), 500);
    return () => window.clearInterval(id);
  }, [engine]);

  if (!DEBUG_ENABLED || !stats) return null;

  const rows: [string, string][] = [
    ['status', status],
    ['fps', String(stats.fps)],
    ['faces', String(stats.faces)],
    ['track', `${stats.trackingMs.toFixed(1)}ms`],
    ['render', `${stats.renderMs.toFixed(1)}ms`],
    ['filter', stats.filterId],
    ['webgl2', stats.webgl ? 'yes' : 'no'],
    ['source', `${stats.width}x${stats.height}`],
  ];

  return (
    <div className="pointer-events-none rounded-lg border border-white/10 bg-black/70 px-2 py-1.5 font-mono text-[10px] leading-tight text-emerald-300">
      {rows.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="w-12 text-white/40">{key}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
