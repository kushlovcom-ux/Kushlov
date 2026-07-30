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
    // Required for face-mask / participant attributes (setAttributes).
    canUpdateOwnMetadata: true,
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

/** Mute or unmute all published tracks for a participant (hold / moderation). */
export async function setParticipantMuted(
  roomName: string,
  identity: string,
  muted: boolean,
): Promise<void> {
  if (!hasLiveKit) return;
  try {
    const participants = await getRoomClient().listParticipants(roomName);
    const target = participants.find((p) => p.identity === identity);
    if (!target) return;
    for (const track of target.tracks) {
      if (!track.sid) continue;
      try {
        await getRoomClient().mutePublishedTrack(roomName, identity, track.sid, muted);
      } catch {
        /* track may have ended */
      }
    }
  } catch {
    /* room missing */
  }
}

export async function closeRoom(roomName: string): Promise<void> {
  if (!hasLiveKit) return;
  try {
    await getRoomClient().deleteRoom(roomName);
  } catch {
    /* room may already be gone */
  }
}

/** Returns participant identities currently in the room, or `null` if LiveKit is unavailable. */
export async function listRoomIdentities(roomName: string): Promise<string[] | null> {
  if (!hasLiveKit) return null;
  try {
    const participants = await getRoomClient().listParticipants(roomName);
    return participants.map((p) => p.identity);
  } catch {
    // Room missing / empty — treat as no participants.
    return [];
  }
}

/** True when `identity` is connected to the LiveKit room. */
export async function isIdentityInRoom(roomName: string, identity: string): Promise<boolean | null> {
  const identities = await listRoomIdentities(roomName);
  if (identities === null) return null;
  return identities.includes(identity);
}
