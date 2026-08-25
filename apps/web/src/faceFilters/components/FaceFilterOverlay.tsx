'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, type Participant } from 'livekit-client';
import { getFilterDef } from '../catalog';
import { heuristicFaceBox, layoutFilter, layoutFilterLayers, parseFaceBox } from '../layout';
import { drawFilterLayer } from '../renderer/drawFilterLayers';
import { FACE_FILTER_ATTR, FACE_FILTER_BOX_ATTR, FACE_FILTER_TOPIC } from '../types';

type FilterPacket = { t?: string; id?: string; box?: string; from?: string };

/** Overlay AR layers on a remote video tile from LiveKit attributes / data packets. */
export function FaceFilterOverlay({ participant }: { participant: Participant }) {
  const room = useRoomContext();
  const [filterId, setFilterId] = useState(
    () => participant.attributes?.[FACE_FILTER_ATTR] || '',
  );
  const [boxRaw, setBoxRaw] = useState(
    () => participant.attributes?.[FACE_FILTER_BOX_ATTR] || '',
  );
  const filter = getFilterDef(filterId);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const sync = () => {
      setFilterId(participant.attributes?.[FACE_FILTER_ATTR] || '');
      setBoxRaw(participant.attributes?.[FACE_FILTER_BOX_ATTR] || '');
    };
    sync();
    participant.on('attributesChanged', sync);

    const onData = (
      payload: Uint8Array,
      from?: Participant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== FACE_FILTER_TOPIC) return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as FilterPacket;
        if (msg?.t !== 'ff') return;
        const identity = from?.identity || msg.from;
        if (identity && identity !== participant.identity) return;
        if (!identity) return;
        setFilterId(msg.id || '');
        if (typeof msg.box === 'string') setBoxRaw(msg.box);
      } catch {
        /* ignore */
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    const poll = window.setInterval(sync, 1500);
    return () => {
      participant.off('attributesChanged', sync);
      room.off(RoomEvent.DataReceived, onData);
      window.clearInterval(poll);
    };
  }, [participant, room]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !filter) return;

    const paint = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || 0;
      const h = parent?.clientHeight || 0;
      if (w < 8 || h < 8) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      const box = parseFaceBox(boxRaw) ?? heuristicFaceBox();
      if (filter.layers?.length) {
        for (const layer of layoutFilterLayers(box, filter, w, h)) {
          drawFilterLayer(ctx, layer.kind, layer);
        }
      } else if (filter.privacy) {
        const layout = layoutFilter(box, filter, w, h);
        ctx.save();
        ctx.translate(layout.x, layout.y);
        ctx.rotate((layout.rotation * Math.PI) / 180);
        ctx.fillStyle = filter.privacy === 'solid' ? '#111' : 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 0, layout.w / 2, layout.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    paint();
    const ro = new ResizeObserver(paint);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [filter, boxRaw]);

  if (!filter || filter.beauty || filter.background) {
    if (filter?.beauty) {
      return <div className="pointer-events-none absolute inset-0 bg-pink-200/10" />;
    }
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
