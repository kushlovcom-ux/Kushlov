/**
 * Lightweight in-memory token-bucket style throttle for Socket.io events.
 * Prefer per-user keys so multi-tab abuse still counts together.
 */
export function createSocketThrottle(maxPerWindow: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  // Periodic cleanup to avoid unbounded growth.
  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [key, times] of hits) {
      const next = times.filter((t) => now - t < windowMs);
      if (next.length === 0) hits.delete(key);
      else hits.set(key, next);
    }
  }, Math.max(windowMs, 30_000));
  if (typeof cleaner.unref === 'function') cleaner.unref();

  return (key: string): boolean => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= maxPerWindow) {
      hits.set(key, arr);
      return false;
    }
    arr.push(now);
    hits.set(key, arr);
    return true;
  };
}
