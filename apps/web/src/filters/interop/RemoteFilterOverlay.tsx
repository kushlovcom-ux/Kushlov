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
  objectFitContentRect,
  parseRemoteFaceBox,
  remoteFilterSprites,
  type ObjectFit,
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

function tileVideo(parent: HTMLElement | null): HTMLVideoElement | null {
  return parent?.querySelector('video') ?? null;
}

/**
 * Draws a remote participant's filter on their video tile.
 *
 * Only needed when that participant could not bake the effect into their own
 * pixels — currently mobile clients without the native GPU path. Publishers
 * that set the baked flag are left alone, otherwise the effect lands twice.
 *
 * Face boxes are in the published video frame. Web calls use object-contain, so
 * this overlay must paint inside that image rect — not the letterbox — or
 * glasses sit on top of the local PiP.
 */
export function RemoteFilterOverlay({
  participant,
  videoFit = 'cover',
}: {
  participant: Participant;
  videoFit?: ObjectFit;
}) {
  const room = useRoomContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filterId, setFilterId] = useState(() => participant.attributes?.[FILTER_ATTR] || '');
  const [boxRaw, setBoxRaw] = useState(() => participant.attributes?.[FACE_BOX_ATTR] || '');
  const [baked, setBaked] = useState(
    () => participant.attributes?.[FILTER_BAKED_ATTR] === '1',
  );

  useEffect(() => {
    if (participant.isLocal) return;

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
        if (from?.isLocal || identity === room.localParticipant?.identity) return;
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

  const sprites = baked || participant.isLocal ? null : remoteFilterSprites(filterId);
  const privacy = !baked && !participant.isLocal && isRemotePrivacyFilter(filterId);
  const shouldDraw = Boolean(sprites?.length) || privacy;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shouldDraw) return;

    let raf = 0;
    let cancelled = false;
    const paint = () => {
      if (cancelled) return;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 0;
      const h = parent?.clientHeight ?? 0;
      if (w < 8 || h < 8) {
        raf = requestAnimationFrame(paint);
        return;
      }
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        raf = requestAnimationFrame(paint);
        return;
      }
      ctx.clearRect(0, 0, w, h);

      const box = parseRemoteFaceBox(boxRaw);
      if (!box) {
        raf = requestAnimationFrame(paint);
        return;
      }

      const video = tileVideo(parent);
      if (!video || video.videoWidth < 2 || video.videoHeight < 2) {
        raf = requestAnimationFrame(paint);
        return;
      }
      const rect = objectFitContentRect(w, h, video.videoWidth, video.videoHeight, videoFit);
      if (rect.w < 8 || rect.h < 8) {
        raf = requestAnimationFrame(paint);
        return;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();

      if (privacy) {
        ctx.save();
        ctx.translate(rect.x + box.cx * rect.w, rect.y + box.cy * rect.h);
        ctx.rotate((box.rotation * Math.PI) / 180);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          (box.width * rect.w * 1.18) / 2,
          (box.height * rect.h * 1.18) / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
      }

      if (sprites?.length) {
        for (const layout of layoutRemoteSprites(box, sprites, rect.w, rect.h)) {
          const bitmap = spriteBitmap(layout.sprite);
          if (!bitmap || layout.w < 4 || layout.h < 4) continue;
          ctx.save();
          ctx.translate(rect.x + layout.x, rect.y + layout.y);
          ctx.rotate(layout.rotation);
          ctx.drawImage(bitmap, -layout.w / 2, -layout.h / 2, layout.w, layout.h);
          ctx.restore();
        }
      }

      ctx.restore();
      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    const observer = new ResizeObserver(() => {
      /* next rAF tick reads the new size */
    });
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [shouldDraw, sprites, privacy, boxRaw, videoFit]);

  if (participant.isLocal || !shouldDraw) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
    />
  );
}
