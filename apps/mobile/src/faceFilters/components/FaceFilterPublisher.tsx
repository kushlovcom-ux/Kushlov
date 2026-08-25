import React, { useEffect, useRef } from 'react';
import { RoomEvent, type Room } from 'livekit-client';
import {
  isFaceTrackNativeAvailable,
  subscribeNativeFace,
  type NativeFaceEvent,
} from 'kushlov-face-track';
import {
  selectEffectiveFilterId,
  useFaceFilterStore,
} from '../hooks/useFaceFilter';
import { boxFromDetection, smoothBox } from '../layout';
import {
  startProcessedVideoTrack,
  type ProcessedTrackController,
} from '../livekit/publishProcessedTrack';
import { attachLiveKitFaceTrack } from '../tracking/attachLiveKitFaceTrack';
import type { FaceBox } from '../types';

type Props = {
  room: Room | null;
};

function boxFromNative(ev: NativeFaceEvent): FaceBox | null {
  if (!ev.detected || ev.cx == null || ev.cy == null) return null;
  return boxFromDetection({
    cx: ev.cx,
    cy: ev.cy,
    width: ev.width ?? 0.42,
    height: ev.height ?? 0.54,
    rotation: ev.rotation ?? 0,
    eyes:
      ev.eyeCx != null && ev.eyeCy != null
        ? { cx: ev.eyeCx, cy: ev.eyeCy, width: ev.eyeW ?? 0.32 }
        : undefined,
    forehead:
      ev.foreheadCx != null && ev.foreheadCy != null
        ? { cx: ev.foreheadCx, cy: ev.foreheadCy }
        : undefined,
    mouth:
      ev.mouthCx != null && ev.mouthCy != null
        ? { cx: ev.mouthCx, cy: ev.mouthCy }
        : undefined,
    nose:
      ev.noseCx != null && ev.noseCy != null
        ? { cx: ev.noseCx, cy: ev.noseCy }
        : undefined,
  });
}

/**
 * Applies the selected face filter via LiveKit attribute + data sync
 * so remotes can overlay the same AR layers. Attaches native face tracking
 * to the existing LiveKit camera capturer (no second camera).
 */
export function FaceFilterPublisher({ room }: Props) {
  const filterId = useFaceFilterStore(selectEffectiveFilterId);
  const setFaceDetected = useFaceFilterStore((s) => s.setFaceDetected);
  const setLocalFaceBox = useFaceFilterStore((s) => s.setLocalFaceBox);
  const ctrlRef = useRef<ProcessedTrackController | null>(null);
  const startingRef = useRef<Promise<ProcessedTrackController> | null>(null);
  const lastBoxRef = useRef<FaceBox | null>(null);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    const run = async () => {
      try {
        if (!ctrlRef.current) {
          if (!startingRef.current) {
            startingRef.current = startProcessedVideoTrack(room);
          }
          ctrlRef.current = await startingRef.current;
        }
        if (cancelled) return;
        void ctrlRef.current.setFilter(filterId);
        if (filterId === 'none') {
          setFaceDetected(false);
          setLocalFaceBox(null);
          lastBoxRef.current = null;
        } else if (!isFaceTrackNativeAvailable()) {
          setFaceDetected(true);
        }
      } catch {
        startingRef.current = null;
      }
    };

    void run();

    const onPeer = () => {
      void ctrlRef.current?.resync();
    };
    room.on(RoomEvent.ParticipantConnected, onPeer);
    room.on(RoomEvent.Connected, onPeer);

    const pulse = setInterval(() => {
      void ctrlRef.current?.resync();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(pulse);
      room.off(RoomEvent.ParticipantConnected, onPeer);
      room.off(RoomEvent.Connected, onPeer);
    };
  }, [room, filterId, setFaceDetected, setLocalFaceBox]);

  useEffect(() => {
    if (!room || filterId === 'none') {
      setLocalFaceBox(null);
      lastBoxRef.current = null;
      return;
    }

    const detach = attachLiveKitFaceTrack(room, isFaceTrackNativeAvailable());
    const unsub = subscribeNativeFace((ev) => {
      const next = boxFromNative(ev);
      if (!next) {
        if (missTimerRef.current) return;
        missTimerRef.current = setTimeout(() => {
          setFaceDetected(false);
          missTimerRef.current = null;
        }, 480);
        return;
      }
      if (missTimerRef.current) {
        clearTimeout(missTimerRef.current);
        missTimerRef.current = null;
      }
      const smoothed = smoothBox(lastBoxRef.current, next, 0.36);
      lastBoxRef.current = smoothed;
      setLocalFaceBox(smoothed);
      setFaceDetected(true);
      ctrlRef.current?.setBox(smoothed);
    });

    return () => {
      unsub();
      detach();
      if (missTimerRef.current) {
        clearTimeout(missTimerRef.current);
        missTimerRef.current = null;
      }
    };
  }, [room, filterId, setFaceDetected, setLocalFaceBox]);

  useEffect(() => {
    return () => {
      void ctrlRef.current?.stop();
      ctrlRef.current = null;
      startingRef.current = null;
      setLocalFaceBox(null);
      lastBoxRef.current = null;
    };
  }, [room, setLocalFaceBox]);

  return null;
}
