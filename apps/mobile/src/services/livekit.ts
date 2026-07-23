import { Platform } from 'react-native';

export type LiveKitConnectParams = {
  url: string;
  token: string;
  /** Publish local microphone after connect (default false). */
  publishAudio?: boolean;
  /** Publish local camera after connect (default false). */
  publishVideo?: boolean;
};

let nativeReady = false;

export async function ensureLiveKitNative(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    // Soft-fail in Expo Go where native modules may be missing
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webrtc = require('@livekit/react-native-webrtc');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lk = require('@livekit/react-native');
    if (lk?.registerGlobals && !nativeReady) {
      lk.registerGlobals();
      nativeReady = true;
    }
    try {
      await lk?.AudioSession?.startAudioSession?.();
    } catch {
      // optional on some platforms
    }
    return !!(webrtc && lk);
  } catch {
    return false;
  }
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
