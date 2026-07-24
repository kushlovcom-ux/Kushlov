import { LocalVideoTrack, Track, type Room } from 'livekit-client';
import { FACE_FILTER_ATTR, type FaceFilterId } from '../types';
import { createFaceTrackingEngine } from '../tracking/FaceTrackingEngine';

export type ProcessedTrackController = {
  setFilter: (id: FaceFilterId) => Promise<void>;
  stop: () => Promise<void>;
  faceDetected: () => boolean;
  /** `bitstream` when native frame processor is available; else attribute+overlay sync. */
  mode: () => 'bitstream' | 'attribute';
};

type NativeBridge = {
  start: (filterId: FaceFilterId) => Promise<MediaStreamTrack | null>;
  setFilter: (filterId: FaceFilterId) => Promise<void>;
  stop: () => Promise<void>;
};

declare global {
  // Optional EAS native module hook
  // eslint-disable-next-line no-var
  var __KushlovFaceFilterCapture: NativeBridge | undefined;
}

/**
 * Publishes filtered video when a native capture bridge exists (EAS).
 * Otherwise syncs filter id via LiveKit attributes so remotes can overlay,
 * and keeps local tracking engine warm for future frame processors.
 */
export async function startProcessedVideoTrack(
  room: Room,
): Promise<ProcessedTrackController> {
  const engine = createFaceTrackingEngine();
  let filterId: FaceFilterId = 'none';
  let mode: 'bitstream' | 'attribute' = 'attribute';
  let lkTrack: LocalVideoTrack | null = null;
  let detected = true;

  const syncAttr = async (id: FaceFilterId) => {
    try {
      await room.localParticipant.setAttributes({
        [FACE_FILTER_ATTR]: id === 'none' ? '' : id,
      });
    } catch {
      /* soft fail */
    }
  };

  const applyBitstream = async (id: FaceFilterId) => {
    const bridge = globalThis.__KushlovFaceFilterCapture;
    if (!bridge || id === 'none') return false;
    try {
      const mediaTrack = await bridge.start(id);
      if (!mediaTrack) return false;
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.track) {
        await room.localParticipant.unpublishTrack(pub.track);
      }
      lkTrack = new LocalVideoTrack(mediaTrack, undefined, true);
      await room.localParticipant.publishTrack(lkTrack, {
        source: Track.Source.Camera,
        name: 'camera-filtered',
      });
      mode = 'bitstream';
      return true;
    } catch {
      return false;
    }
  };

  return {
    mode: () => mode,
    faceDetected: () => {
      void engine.detect(640, 480).then((box) => {
        detected = !!box;
      });
      return detected;
    },
    setFilter: async (id) => {
      filterId = id;
      if (id === 'none') {
        if (lkTrack) {
          try {
            await room.localParticipant.unpublishTrack(lkTrack);
          } catch {
            /* ignore */
          }
          lkTrack.stop();
          lkTrack = null;
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch {
            /* ignore */
          }
        }
        await globalThis.__KushlovFaceFilterCapture?.stop();
        mode = 'attribute';
        await syncAttr('none');
        return;
      }
      const ok = await applyBitstream(id);
      if (!ok) {
        mode = 'attribute';
        await syncAttr(id);
      } else {
        await globalThis.__KushlovFaceFilterCapture?.setFilter(id);
        await syncAttr(id);
      }
    },
    stop: async () => {
      await syncAttr('none');
      if (lkTrack) {
        try {
          await room.localParticipant.unpublishTrack(lkTrack);
        } catch {
          /* ignore */
        }
        lkTrack.stop();
        lkTrack = null;
      }
      await globalThis.__KushlovFaceFilterCapture?.stop();
      engine.dispose?.();
      try {
        await room.localParticipant.setCameraEnabled(true);
      } catch {
        /* ignore */
      }
    },
  };
}
