import { ConnectionState, RoomEvent, type Room } from 'livekit-client';
import {
  FACE_FILTER_ATTR,
  FACE_FILTER_BOX_ATTR,
  FACE_FILTER_TOPIC,
  type FaceBox,
  type FaceFilterId,
} from '../types';
import { heuristicFaceBox, serializeFaceBox } from '../layout';

export type ProcessedTrackController = {
  setFilter: (id: FaceFilterId) => Promise<void>;
  setBox: (box: FaceBox) => void;
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
  let liveBox: FaceBox | null = null;
  let lastAttrAt = 0;
  let lastDataAt = 0;

  const boxPayload = (id: FaceFilterId) => {
    if (id === 'none') return '';
    return serializeFaceBox(liveBox ?? heuristicFaceBox());
  };

  const broadcast = async (id: FaceFilterId, opts?: { dataOnly?: boolean }) => {
    try {
      await whenConnected(room);
    } catch {
      /* still try */
    }
    const value = id === 'none' ? '' : id;
    const box = boxPayload(id);
    const identity = room.localParticipant?.identity || '';
    const now = Date.now();
    if (!opts?.dataOnly || now - lastAttrAt > 900) {
      lastAttrAt = now;
      try {
        await room.localParticipant.setAttributes({
          [FACE_FILTER_ATTR]: value,
          [FACE_FILTER_BOX_ATTR]: box,
        });
      } catch {
        /* some SFUs reject unknown attrs — data packet still goes out */
      }
    }
    if (now - lastDataAt < 110) return;
    lastDataAt = now;
    try {
      const payload = encoder.encode(
        JSON.stringify({ t: 'ff', id: value, box: box || undefined, from: identity }),
      );
      await room.localParticipant.publishData(payload, {
        reliable: !liveBox,
        topic: FACE_FILTER_TOPIC,
      });
    } catch {
      /* overlay still works locally */
    }
  };

  return {
    mode: () => 'attribute',
    faceDetected: () => filterId !== 'none' && liveBox != null,
    resync: async () => {
      await broadcast(filterId);
    },
    setBox: (box) => {
      liveBox = box;
      if (filterId === 'none') return;
      void broadcast(filterId, { dataOnly: true });
    },
    setFilter: async (id) => {
      filterId = id;
      if (id === 'none') liveBox = null;
      await broadcast(id);
    },
    stop: async () => {
      liveBox = null;
      await broadcast('none');
    },
  };
}
