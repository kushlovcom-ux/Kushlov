import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { env, hasLiveKit } from '../config/env';
import { ApiError } from '../utils/ApiError';

/**
 * LiveKit powers 1:1 audio/video calls and live streaming. This service issues
 * scoped access tokens and exposes room management helpers.
 */
export interface TokenGrant {
  identity: string;
  name?: string;
  roomName: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  metadata?: Record<string, unknown>;
  ttlSeconds?: number;
}

export async function createLiveKitToken(grant: TokenGrant): Promise<string> {
  if (!hasLiveKit) throw ApiError.internal('LiveKit is not configured');

  const at = new AccessToken(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!, {
    identity: grant.identity,
    name: grant.name,
    ttl: grant.ttlSeconds ?? 60 * 60,
    metadata: grant.metadata ? JSON.stringify(grant.metadata) : undefined,
  });

  at.addGrant({
    room: grant.roomName,
    roomJoin: true,
    canPublish: grant.canPublish ?? true,
    canSubscribe: grant.canSubscribe ?? true,
    canPublishData: grant.canPublishData ?? true,
  });

  return at.toJwt();
}

let roomClient: RoomServiceClient | null = null;
function getRoomClient(): RoomServiceClient {
  if (!hasLiveKit) throw ApiError.internal('LiveKit is not configured');
  if (!roomClient) {
    const httpUrl = env.LIVEKIT_URL!.replace(/^ws/, 'http');
    roomClient = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);
  }
  return roomClient;
}

/** Forcefully remove a participant (used for ban/kick in live streams). */
export async function removeParticipant(roomName: string, identity: string): Promise<void> {
  if (!hasLiveKit) return;
  await getRoomClient().removeParticipant(roomName, identity);
}

/** Mute a participant's published tracks (moderation). */
export async function muteParticipant(
  roomName: string,
  identity: string,
  trackSid: string,
  muted: boolean,
): Promise<void> {
  if (!hasLiveKit) return;
  await getRoomClient().mutePublishedTrack(roomName, identity, trackSid, muted);
}

export async function closeRoom(roomName: string): Promise<void> {
  if (!hasLiveKit) return;
  try {
    await getRoomClient().deleteRoom(roomName);
  } catch {
    /* room may already be gone */
  }
}
