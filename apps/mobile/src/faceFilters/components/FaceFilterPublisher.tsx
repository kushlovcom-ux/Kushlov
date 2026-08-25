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
 * Publishes the selected filter via LiveKit attributes + data so remotes
 * can overlay the same AR layers. Does not hook the camera capturer —
 * attaching a WebRTC VideoFrameProcessor was crashing the host app on live/call.
 */
export function FaceFilterPublisher({ room }: Props) {
  const filterId = useFaceFilterStore(selectEffectiveFilterId);
  const setFaceDetected = useFaceFilterStore((s) => s.setFaceDetected);
  const setLocalFaceBox = useFaceFilterStore((s) => s.setLocalFaceBox);
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
        setFaceDetected(filterId !== 'none');
        if (filterId === 'none') setLocalFaceBox(null);
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
    return () => {
      void ctrlRef.current?.stop();
      ctrlRef.current = null;
      startingRef.current = null;
      setLocalFaceBox(null);
    };
  }, [room, setLocalFaceBox]);

  return null;
}
