import { ConnectionState, RoomEvent, type Room } from 'livekit-client';
import {
  FACE_FILTER_ATTR,
  FACE_FILTER_BOX_ATTR,
  FACE_FILTER_TOPIC,
  type FaceFilterId,
} from '../types';
import { heuristicFaceBox, serializeFaceBox } from '../layout';

export type ProcessedTrackController = {
  setFilter: (id: FaceFilterId) => Promise<void>;
  resync: () => Promise<void>;
  stop: () => Promise<void>;
  faceDetected: () => boolean;
  mode: () => 'bitstream' | 'attribute';
};

const encoder = new TextEncoder();

async function whenConnected(room: Room) {
  if (room.state === ConnectionState.Connected) return;
  await new Promise<void>((resolve) => {
    if (room.state === ConnectionState.Connected) {
      resolve();
      return;
    }
    const done = () => {
      room.off(RoomEvent.Connected, done);
      resolve();
    };
    room.on(RoomEvent.Connected, done);
    setTimeout(() => {
      room.off(RoomEvent.Connected, done);
      resolve();
    }, 8000);
  });
}

/**
 * Publishes the selected filter to remotes via LiveKit attributes + data packets
 * so the other person can overlay the same AR layers.
 *
 * Mobile keeps LiveKit's camera track (no second capturer / no bitstream replace)
 * to avoid duplicate video windows.
 */
export async function startProcessedVideoTrack(
  room: Room,
): Promise<ProcessedTrackController> {
  let filterId: FaceFilterId = 'none';

  const broadcast = async (id: FaceFilterId) => {
    try {
      await whenConnected(room);
    } catch {
      /* still try */
    }
    const value = id === 'none' ? '' : id;
    const box = value ? serializeFaceBox(heuristicFaceBox()) : '';
    const identity = room.localParticipant?.identity || '';
    try {
      await room.localParticipant.setAttributes({
        [FACE_FILTER_ATTR]: value,
        [FACE_FILTER_BOX_ATTR]: box,
      });
    } catch {
      /* some SFUs reject unknown attrs — data packet still goes out */
    }
    try {
      const payload = encoder.encode(
        JSON.stringify({ t: 'ff', id: value, box: box || undefined, from: identity }),
      );
      await room.localParticipant.publishData(payload, {
        reliable: true,
        topic: FACE_FILTER_TOPIC,
      });
    } catch {
      /* overlay still works locally */
    }
  };

  return {
    mode: () => 'attribute',
    faceDetected: () => filterId !== 'none',
    resync: async () => {
      await broadcast(filterId);
    },
    setFilter: async (id) => {
      filterId = id;
      await broadcast(id);
    },
    stop: async () => {
      await broadcast('none');
    },
  };
}
