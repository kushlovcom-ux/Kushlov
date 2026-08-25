import { RoomEvent, Track, type LocalTrackPublication, type Room } from 'livekit-client';
import {
  FACE_TRACK_EFFECT,
  ensureFaceProcessorRegistered,
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
  const track = cameraTrack(room);
  if (!track?._setVideoEffects) return false;
  try {
    if (enabled) track._setVideoEffect?.(FACE_TRACK_EFFECT);
    else track._setVideoEffects([]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Samples LiveKit camera frames with ML Kit / Vision. Waits until the
 * camera track exists, then attaches once (re-attaching restarts the
 * capturer and was crashing the host app).
 */
export function attachLiveKitFaceTrack(room: Room, enabled: boolean): () => void {
  if (!enabled || !isFaceTrackNativeAvailable()) {
    return () => undefined;
  }

  let cancelled = false;
  let attachedSid: string | null = null;
  let delay: ReturnType<typeof setTimeout> | null = null;

  const tryAttach = () => {
    if (cancelled) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const sid = pub?.trackSid || 'cam';
    if (!cameraTrack(room)) return;
    if (attachedSid === sid) return;
    if (delay) clearTimeout(delay);
    delay = setTimeout(() => {
      delay = null;
      if (cancelled) return;
      if (applyEffect(room, true)) attachedSid = sid;
    }, 480);
  };

  void ensureFaceProcessorRegistered().then(() => {
    if (cancelled) return;
    tryAttach();
  });

  const onPub = (publication: LocalTrackPublication) => {
    if (publication.source !== Track.Source.Camera) return;
    attachedSid = null;
    tryAttach();
  };

  room.on(RoomEvent.LocalTrackPublished, onPub);

  return () => {
    cancelled = true;
    if (delay) clearTimeout(delay);
    room.off(RoomEvent.LocalTrackPublished, onPub);
    applyEffect(room, false);
  };
}
