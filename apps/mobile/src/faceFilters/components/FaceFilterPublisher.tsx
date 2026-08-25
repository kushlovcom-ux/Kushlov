import React, { useEffect, useRef } from 'react';
import { RoomEvent, type Room } from 'livekit-client';
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
 * Applies the selected face filter via LiveKit attribute + data sync
 * so remotes can overlay the same AR layers.
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
        void ctrlRef.current.setFilter(filterId);
        setFaceDetected(true);
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
