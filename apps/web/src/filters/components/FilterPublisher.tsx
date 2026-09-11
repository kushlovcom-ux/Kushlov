'use client';

import { useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track, type LocalVideoTrack } from 'livekit-client';
import { useFilters } from '../hooks/useFilters';

/**
 * Attaches the filter engine to the published camera track.
 *
 * Uses LiveKit's TrackProcessor hook, so switching filters never unpublishes,
 * never reopens the camera and never renegotiates — the sender keeps the same
 * publication and LiveKit swaps the underlying MediaStreamTrack for us.
 */
export function FilterPublisher() {
  const { engine, activeFilterId, beauty, processingWanted } = useFilters();
  const { cameraTrack } = useLocalParticipant();

  const localVideo =
    cameraTrack?.track && cameraTrack.track.kind === Track.Kind.Video
      ? (cameraTrack.track as LocalVideoTrack)
      : null;

  // Serialises attach/detach so a fast filter toggle cannot interleave two
  // setProcessor calls on the same track.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const attachedRef = useRef<LocalVideoTrack | null>(null);

  const enqueue = (job: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(job).catch(() => {
      /* a processor failure must leave the raw camera publishing */
    });
    return queueRef.current;
  };

  useEffect(() => {
    if (!engine || !localVideo) return;

    void enqueue(async () => {
      if (processingWanted) {
        if (attachedRef.current !== localVideo) {
          await localVideo.setProcessor(engine);
          attachedRef.current = localVideo;
        }
        engine.loadFilter(activeFilterId);
        engine.setBeauty(beauty);
      } else if (attachedRef.current === localVideo) {
        attachedRef.current = null;
        await localVideo.stopProcessor();
      }
    });
  }, [engine, localVideo, processingWanted, activeFilterId, beauty]);

  // Detach when the tile unmounts or the camera track is swapped out, so the
  // next publication starts from a clean sender.
  useEffect(() => {
    return () => {
      const attached = attachedRef.current;
      if (!attached) return;
      attachedRef.current = null;
      void attached.stopProcessor().catch(() => {
        /* the track may already be gone */
      });
    };
  }, [localVideo]);

  return null;
}
