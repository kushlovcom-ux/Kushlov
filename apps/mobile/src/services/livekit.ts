import { Platform } from 'react-native';

export type LiveKitConnectParams = {
  url: string;
  token: string;
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
