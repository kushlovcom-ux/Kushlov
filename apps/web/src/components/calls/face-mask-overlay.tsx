'use client';

import { useEffect, useState, type RefObject } from 'react';
import { getFaceMask, type FaceMaskId } from '@kushlov/types';
import { useFaceBox } from '@/hooks/use-face-box';

type Props = {
  containerRef: RefObject<HTMLElement | null>;
  maskId: FaceMaskId | string | null | undefined;
  /** Local camera is usually mirrored */
  mirrored?: boolean;
};

/**
 * Renders an emoji/icon mask only over the detected face region (not full screen).
 * Parent must wrap the <video> and pass that container ref.
 */
export function FaceMaskOverlay({ containerRef, maskId, mirrored = false }: Props) {
  const mask = getFaceMask(maskId);
  const box = useFaceBox(containerRef, !!mask, mirrored);
  const [containerW, setContainerW] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth || 320);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  if (!mask) return null;

  const sizePct = Math.max(box.width, box.height) * mask.scale;
  const fontPx = Math.max(28, (sizePct / 100) * containerW * 0.95);
  const yOffset =
    mask.id === 'crown' ? -box.height * 0.55 : mask.id === 'sunglasses' ? -box.height * 0.08 : 0;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute flex select-none items-center justify-center leading-none"
        style={{
          left: `${box.cx}%`,
          top: `${box.cy + yOffset}%`,
          transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
          fontSize: fontPx,
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))',
        }}
      >
        {mask.emoji}
      </div>
    </div>
  );
}
