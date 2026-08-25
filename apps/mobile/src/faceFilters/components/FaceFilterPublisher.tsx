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
  const ctrlRef = useRef<ProcessedTrackController | null>(null);
  const startingRef = useRef<Promise<ProcessedTrackController> | null>(null);

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
        // Attribute + overlay apply immediately; do not tear down on "none".
        void ctrlRef.current.setFilter(filterId);
        setFaceDetected(true);
      } catch {
        startingRef.current = null;
      }
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
      startingRef.current = null;
    };
  }, [room]);

  return null;
}
