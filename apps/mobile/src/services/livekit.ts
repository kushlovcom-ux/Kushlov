import { Platform } from 'react-native';
import type { ComponentType } from 'react';
import type { Room } from 'livekit-client';

export type LiveKitConnectParams = {
  url: string;
  token: string;
  /** Publish local microphone after connect (default false). */
  publishAudio?: boolean;
  /** Publish local camera after connect (default false). */
  publishVideo?: boolean;
};

type LiveKitRn = {
  registerGlobals?: () => void;
  AudioSession?: { startAudioSession?: () => Promise<void> };
  LiveKitRoom: ComponentType<Record<string, unknown>>;
  useTracks: (sources: unknown[], opts?: unknown) => unknown[];
  useRoomContext: () => Room;
  isTrackReference: (t: unknown) => boolean;
  VideoTrack: ComponentType<Record<string, unknown>>;
  Track: { Source: { Camera: unknown } };
};

let nativeReady = false;
let nativeOk = false;
let cachedRn: LiveKitRn | null = null;
let audioStarted = false;

function initLiveKitSync(): boolean {
  if (nativeReady) return nativeOk;
  nativeReady = true;
  if (Platform.OS === 'web') {
    nativeOk = false;
    return false;
  }
  try {
    // Soft-fail in Expo Go where native modules may be missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webrtc = require('@livekit/react-native-webrtc');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lk = require('@livekit/react-native');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Track } = require('livekit-client');
    if (!webrtc || !lk?.LiveKitRoom) {
      nativeOk = false;
      return false;
    }
    lk.registerGlobals?.();
    cachedRn = {
      registerGlobals: lk.registerGlobals,
      AudioSession: lk.AudioSession,
      LiveKitRoom: lk.LiveKitRoom,
      useTracks: lk.useTracks,
      useRoomContext: lk.useRoomContext,
      isTrackReference: lk.isTrackReference,
      VideoTrack: lk.VideoTrack,
      Track,
    };
    nativeOk = true;
    return true;
  } catch {
    nativeOk = false;
    cachedRn = null;
    return false;
  }
}

function startAudioSession() {
  if (audioStarted || !cachedRn) return;
  audioStarted = true;
  void cachedRn.AudioSession?.startAudioSession?.().catch(() => undefined);
}

/** True when native LiveKit is already registered (sync, no spinner). */
export function isLiveKitNativeReady(): boolean {
  return nativeReady && nativeOk;
}

/** Cached react-native LiveKit modules, or null if unavailable. */
export function getLiveKitRn(): LiveKitRn | null {
  if (!initLiveKitSync()) return null;
  return cachedRn;
}

/** Warm native modules at app boot so calls/live open without a Connecting screen. */
export function preloadLiveKitNative(): boolean {
  const ok = initLiveKitSync();
  if (ok) startAudioSession();
  return ok;
}

export async function ensureLiveKitNative(): Promise<boolean> {
  const ok = initLiveKitSync();
  if (ok) startAudioSession();
  return ok;
}

export async function createRoom() {
  const ok = await ensureLiveKitNative();
  if (!ok) {
    throw new Error(
      'LiveKit native modules are unavailable. Use a custom dev client or EAS build for calls/live.',
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Room } = require('livekit-client');
  return new Room() as import('livekit-client').Room;
}

export async function connectRoom(params: LiveKitConnectParams) {
  const room = await createRoom();
  await room.connect(params.url, params.token);
  try {
    if (params.publishAudio) {
      await room.localParticipant.setMicrophoneEnabled(true);
    }
    if (params.publishVideo) {
      await room.localParticipant.setCameraEnabled(true);
    }
  } catch {
    // Permission denial / device missing — room still usable for subscribe
  }
  return room;
}

export async function disconnectRoom(room: import('livekit-client').Room | null) {
  if (!room) return;
  try {
    await room.disconnect();
  } catch {
    // ignore
  }
}
