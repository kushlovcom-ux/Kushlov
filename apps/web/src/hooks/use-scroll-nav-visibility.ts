'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mobile chrome visibility: hidden at rest, shown while the user scrolls,
 * then auto-hides after a short idle.
 */
export function useScrollNavVisibility(opts?: {
  idleMs?: number;
  /** When true, always keep chrome hidden (e.g. fullscreen live). */
  forceHidden?: boolean;
}) {
  const idleMs = opts?.idleMs ?? 1600;
  const forceHidden = opts?.forceHidden ?? false;
  const [visible, setVisible] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBriefly = useCallback(() => {
    if (forceHidden) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setVisible(false), idleMs);
  }, [forceHidden, idleMs]);

  useEffect(() => {
    if (forceHidden) {
      setVisible(false);
      return;
    }

    const onScroll = () => showBriefly();
    // Capture scroll from any nested overflow container + window.
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('touchmove', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('touchmove', onScroll);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [forceHidden, showBriefly]);

  return forceHidden ? false : visible;
}
