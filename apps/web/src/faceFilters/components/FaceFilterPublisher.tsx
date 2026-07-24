'use client';

import { useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { useFaceFilterOptional } from '../hooks/useFaceFilter';
import {
  startProcessedVideoTrack,
  type ProcessedTrackController,
} from '../livekit/publishProcessedTrack';

/**
 * When a non-none filter is selected, replaces the LiveKit camera track
 * with a canvas-processed stream (filtered video reaches remotes).
 */
export function FaceFilterPublisher() {
  const ctx = useFaceFilterOptional();
  const { localParticipant } = useLocalParticipant();
  const ctrlRef = useRef<ProcessedTrackController | null>(null);

  const activeFilterId = ctx?.activeFilterId ?? 'none';
  const enabled = ctx?.settings.enabled ?? false;
  const setFaceDetected = ctx?.setFaceDetected;

  useEffect(() => {
    if (!ctx || !localParticipant || !setFaceDetected) return;
    let cancelled = false;

    const run = async () => {
      if (activeFilterId === 'none' || !enabled) {
        if (ctrlRef.current) {
          await ctrlRef.current.stop();
          ctrlRef.current = null;
        }
        return;
      }
      if (!ctrlRef.current) {
        try {
          ctrlRef.current = await startProcessedVideoTrack(localParticipant, {
            mirrored: true,
            maxFps: 30,
          });
        } catch {
          return;
        }
      }
      if (cancelled) return;
      ctrlRef.current.setFilter(activeFilterId);
    };

    void run();

    const poll = window.setInterval(() => {
      if (ctrlRef.current) setFaceDetected(ctrlRef.current.faceDetected());
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [ctx, activeFilterId, enabled, localParticipant, setFaceDetected]);

  useEffect(() => {
    return () => {
      void ctrlRef.current?.stop();
      ctrlRef.current = null;
    };
  }, []);

  return null;
}
