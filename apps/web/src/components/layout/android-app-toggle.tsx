'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

const APK_HREF = '/kushlov.apk';
const APK_NAME = 'kushlov.apk';
const STORAGE_KEY = 'kushlov.androidToggle.pos.v2';

const WIDTH = 88;
const HEIGHT = 100;
const CIRCLE = 64;
const MARGIN = 12;

type Pos = { x: number; y: number };

function defaultPos(): Pos {
  if (typeof window === 'undefined') return { x: MARGIN, y: MARGIN };
  return {
    x: Math.max(MARGIN, window.innerWidth - WIDTH - 20),
    y: Math.max(MARGIN, window.innerHeight - HEIGHT - 96),
  };
}

function clampPos(pos: Pos): Pos {
  const maxX = Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - HEIGHT - MARGIN);
  return {
    x: Math.min(maxX, Math.max(MARGIN, pos.x)),
    y: Math.min(maxY, Math.max(MARGIN, pos.y)),
  };
}

function loadPos(): Pos {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPos();
    const parsed = JSON.parse(raw) as Partial<Pos>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return defaultPos();
    return clampPos({ x: parsed.x, y: parsed.y });
  } catch {
    return defaultPos();
  }
}

function savePos(pos: Pos) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* private mode */
  }
}

function startApkDownload() {
  const link = document.createElement('a');
  link.href = APK_HREF;
  link.download = APK_NAME;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function shouldHide(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/admin')) return true;
  if (/^\/live\/[^/]+$/.test(pathname)) return true;
  return false;
}

/**
 * Premium floating Android download control. Drag to reposition; tap (without
 * dragging) downloads the APK. Position is remembered in localStorage.
 */
export function AndroidAppToggle() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState<Pos>(defaultPos);
  const [armed, setArmed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const posRef = useRef(pos);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    setPos(loadPos());
    setReady(true);
  }, []);

  useEffect(() => {
    const onResize = () => setPos((current) => clampPos(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: posRef.current.x,
      originY: posRef.current.y,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;

    drag.moved = true;
    setDragging(true);
    setPos(clampPos({ x: drag.originX + dx, y: drag.originY + dy }));
  }, []);

  const finishPointer = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const jumped = Math.hypot(dx, dy) >= 8;
    if (drag.moved || jumped) {
      const next = clampPos({ x: drag.originX + dx, y: drag.originY + dy });
      setPos(next);
      savePos(next);
      return;
    }

    setArmed(true);
    startApkDownload();
    window.setTimeout(() => setArmed(false), 1600);
  }, []);

  if (!ready || shouldHide(pathname)) return null;

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{ left: pos.x, top: pos.y, width: WIDTH, height: HEIGHT }}
    >
      <button
        type="button"
        aria-label={armed ? 'Downloading Kushlov Android app' : 'Download Kushlov Android app'}
        aria-pressed={armed}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        className={cn(
          'pointer-events-auto flex w-full flex-col items-center gap-1.5',
          'select-none touch-none outline-none',
          dragging ? 'cursor-grabbing' : 'cursor-grab apk-float',
        )}
        style={dragging ? undefined : { animation: 'apk-float 2.8s ease-in-out infinite' }}
      >
        <span className="relative flex items-center justify-center" style={{ width: CIRCLE, height: CIRCLE }}>
          <span
            aria-hidden
            className="apk-ring pointer-events-none absolute inset-0 rounded-full border-2 border-brand-pink/70"
            style={{ animation: dragging ? undefined : 'apk-ring 2.2s ease-out infinite' }}
          />
          <span
            aria-hidden
            className="apk-ring pointer-events-none absolute inset-0 rounded-full border border-violet-400/50"
            style={{ animation: dragging ? undefined : 'apk-ring 2.2s ease-out 1.1s infinite' }}
          />
          <span
            className={cn(
              'apk-glow relative z-10 flex items-center justify-center rounded-full bg-brand-gradient',
              'border border-white/25',
              'transition-transform duration-200',
              dragging && 'scale-105',
              armed && 'apk-pop',
            )}
            style={{
              width: CIRCLE,
              height: CIRCLE,
              animation: armed
                ? 'apk-pop 0.55s ease-out'
                : dragging
                  ? undefined
                  : 'apk-glow 2.4s ease-in-out infinite',
            }}
          >
            <Smartphone
              className="apk-icon h-7 w-7 text-white"
              style={{ animation: dragging || armed ? undefined : 'apk-icon 2.6s ease-in-out infinite' }}
            />
          </span>
        </span>
        <span
          className="apk-label text-center text-[11px] font-semibold leading-tight text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]"
          style={{ animation: dragging ? undefined : 'apk-label 2.4s ease-in-out infinite' }}
        >
          {armed ? 'Downloading…' : 'Get The App'}
        </span>
      </button>
    </div>
  );
}
