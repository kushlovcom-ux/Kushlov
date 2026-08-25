import { RoomEvent, Track, type Room } from 'livekit-client';
import {
  FACE_TRACK_EFFECT,
  isFaceTrackNativeAvailable,
} from 'kushlov-face-track';

type EffectTrack = {
  kind?: string;
  remote?: boolean;
  _setVideoEffect?: (name: string) => void;
  _setVideoEffects?: (names: string[]) => void;
};

function cameraTrack(room: Room): EffectTrack | null {
  const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
  const raw = pub?.track?.mediaStreamTrack as EffectTrack | undefined;
  if (!raw || raw.kind !== 'video' || raw.remote) return null;
  return raw;
}

function applyEffect(room: Room, enabled: boolean) {
  if (!isFaceTrackNativeAvailable()) return;
  const track = cameraTrack(room);
  if (!track?._setVideoEffects) return;
  try {
    if (enabled) track._setVideoEffect?.(FACE_TRACK_EFFECT);
    else track._setVideoEffects([]);
  } catch {
    /* old binary / track already released */
  }
}

/**
 * Hooks ML Kit / Vision into the existing LiveKit camera capturer.
 * Does not open a second camera.
 */
export function attachLiveKitFaceTrack(room: Room, enabled: boolean): () => void {
  if (!enabled) {
    applyEffect(room, false);
    return () => undefined;
  }

  applyEffect(room, true);

  const retry = () => applyEffect(room, true);
  room.on(RoomEvent.LocalTrackPublished, retry);
  room.on(RoomEvent.TrackUnmuted, retry);
  room.on(RoomEvent.Reconnected, retry);

  const pulse = setInterval(retry, 2500);

  return () => {
    clearInterval(pulse);
    room.off(RoomEvent.LocalTrackPublished, retry);
    room.off(RoomEvent.TrackUnmuted, retry);
    room.off(RoomEvent.Reconnected, retry);
    applyEffect(room, false);
  };
}
