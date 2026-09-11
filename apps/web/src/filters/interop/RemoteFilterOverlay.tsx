'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, type Participant } from 'livekit-client';
import {
  FACE_BOX_ATTR,
  FILTER_ATTR,
  FILTER_BAKED_ATTR,
  FILTER_TOPIC,
  type SpriteId,
} from '@kushlov/filter-core';
import { paintSprite } from '../webgl/sprites';
import {
  isRemotePrivacyFilter,
  layoutRemoteSprites,
  parseRemoteFaceBox,
  remoteFilterSprites,
} from './mobileFilters';

type FilterPacket = { t?: string; id?: string; box?: string; from?: string; baked?: number };

/** Sprite bitmaps are shared with the WebGL path; paint each one once per tab. */
const spriteCache = new Map<SpriteId, HTMLCanvasElement | null>();

function spriteBitmap(id: SpriteId): HTMLCanvasElement | null {
  const cached = spriteCache.get(id);
  if (cached !== undefined) return cached;
  const painted = paintSprite(id);
  spriteCache.set(id, painted);
  return painted;
}

/**
 * Draws a remote participant's filter on their video tile.
 *
 * Only needed when that participant could not bake the effect into their own
 * pixels — currently mobile clients without the native GPU path. Publishers
 * that set the baked flag are left alone, otherwise the effect lands twice.
 */
export function RemoteFilterOverlay({ participant }: { participant: Participant }) {
  const room = useRoomContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filterId, setFilterId] = useState(() => participant.attributes?.[FILTER_ATTR] || '');
  const [boxRaw, setBoxRaw] = useState(() => participant.attributes?.[FACE_BOX_ATTR] || '');
  const [baked, setBaked] = useState(
    () => participant.attributes?.[FILTER_BAKED_ATTR] === '1',
  );

  useEffect(() => {
    const sync = () => {
      setFilterId(participant.attributes?.[FILTER_ATTR] || '');
      setBoxRaw(participant.attributes?.[FACE_BOX_ATTR] || '');
      setBaked(participant.attributes?.[FILTER_BAKED_ATTR] === '1');
    };
    sync();
    participant.on('attributesChanged', sync);

    // Some native clients drop attribute updates, so mobile also mirrors the
    // same payload onto a data topic.
    const onData = (
      payload: Uint8Array,
      from?: Participant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== FILTER_TOPIC) return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as FilterPacket;
        if (msg?.t !== 'ff') return;
        const identity = from?.identity || msg.from;
        if (!identity || identity !== participant.identity) return;
        setFilterId(msg.id || '');
        setBaked(msg.baked === 1);
        if (typeof msg.box === 'string') setBoxRaw(msg.box);
      } catch {
        /* malformed packet from an older client */
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      participant.off('attributesChanged', sync);
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [participant, room]);

  const sprites = baked ? null : remoteFilterSprites(filterId);
  const privacy = !baked && isRemotePrivacyFilter(filterId);
  const shouldDraw = Boolean(sprites?.length) || privacy;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shouldDraw) return;

    const paint = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 0;
      const h = parent?.clientHeight ?? 0;
      if (w < 8 || h < 8) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      const box = parseRemoteFaceBox(boxRaw);

      if (privacy) {
        ctx.save();
        ctx.translate(box.cx * w, box.cy * h);
        ctx.rotate((box.rotation * Math.PI) / 180);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 0, (box.width * w * 1.18) / 2, (box.height * h * 1.18) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (!sprites?.length) return;
      for (const layout of layoutRemoteSprites(box, sprites, w, h)) {
        const bitmap = spriteBitmap(layout.sprite);
        if (!bitmap || layout.w < 4 || layout.h < 4) continue;
        ctx.save();
        ctx.translate(layout.x, layout.y);
        ctx.rotate(layout.rotation);
        ctx.drawImage(bitmap, -layout.w / 2, -layout.h / 2, layout.w, layout.h);
        ctx.restore();
      }
    };

    paint();
    const observer = new ResizeObserver(paint);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [shouldDraw, sprites, privacy, boxRaw]);

  if (!shouldDraw) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
