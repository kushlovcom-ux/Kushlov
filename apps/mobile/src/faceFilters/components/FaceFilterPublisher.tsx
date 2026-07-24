import React, { useEffect, useRef } from 'react';
import type { Room } from 'livekit-client';
import {
  selectEffectiveFilterId,
  useFaceFilterStore,
} from '../hooks/useFaceFilter';
import {
  startProcessedVideoTrack,
  type ProcessedTrackController,
} from '../livekit/publishProcessedTrack';

type Props = {
  room: Room | null;
};

/**
 * Applies the selected face filter: bitstream replace when native bridge exists,
 * otherwise LiveKit attribute sync for remote overlays.
 */
export function FaceFilterPublisher({ room }: Props) {
  const filterId = useFaceFilterStore(selectEffectiveFilterId);
  const setFaceDetected = useFaceFilterStore((s) => s.setFaceDetected);
  const setLowBattery = useFaceFilterStore((s) => s.setLowBattery);
  const ctrlRef = useRef<ProcessedTrackController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Soft-load expo-battery when present (EAS builds may include it later).
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const battery = require('expo-battery');
        const level = await battery.getBatteryLevelAsync?.();
        const lowPower = await battery.isLowPowerModeEnabledAsync?.();
        if (!cancelled && (lowPower || (typeof level === 'number' && level >= 0 && level < 0.15))) {
          setLowBattery(true);
        }
      } catch {
        /* package optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setLowBattery]);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    const run = async () => {
      if (filterId === 'none') {
        if (ctrlRef.current) {
          await ctrlRef.current.stop();
          ctrlRef.current = null;
        }
        return;
      }
      if (!ctrlRef.current) {
        try {
          ctrlRef.current = await startProcessedVideoTrack(room);
        } catch {
          return;
        }
      }
      if (cancelled) return;
      await ctrlRef.current.setFilter(filterId);
      setFaceDetected(ctrlRef.current.faceDetected());
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [room, filterId, setFaceDetected]);

  useEffect(() => {
    return () => {
      void ctrlRef.current?.stop();
      ctrlRef.current = null;
    };
  }, []);

  return null;
}
