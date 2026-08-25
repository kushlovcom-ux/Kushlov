import { LocalVideoTrack, Track } from 'livekit-client';
import type { LocalParticipant } from 'livekit-client';
import { FaceTrackingEngine } from '../tracking/FaceTrackingEngine';
import { renderFaceFilterFrame } from '../renderer/renderFaceFilterFrame';
import { getFilterDef } from '../catalog';
import type { FaceFilterId } from '../types';

export type ProcessedTrackController = {
  setFilter: (id: FaceFilterId) => void;
  stop: () => Promise<void>;
  faceDetected: () => boolean;
};

/**
 * Camera → face detect → canvas filter → LiveKit LocalVideoTrack.
 * Replaces the published camera track while a filter is active.
 */
export async function startProcessedVideoTrack(
  localParticipant: LocalParticipant,
  opts?: { mirrored?: boolean; maxFps?: number },
): Promise<ProcessedTrackController> {
  const mirrored = opts?.mirrored ?? true;
  const maxFps = opts?.maxFps ?? 30;
  const engine = new FaceTrackingEngine();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  const camTrack = stream.getVideoTracks()[0];
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = new MediaStream([camTrack]);
  await video.play();

  const canvas = document.createElement('canvas');
  const syncSize = () => {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
  };
  syncSize();
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  let filterId: FaceFilterId = 'none';
  let raf = 0;
  let lastFrame = 0;
  let detected = false;
  let stopped = false;

  const canvasStream = canvas.captureStream(maxFps);
  const processedMedia = canvasStream.getVideoTracks()[0];
  const lkTrack = new LocalVideoTrack(processedMedia, undefined, true);

  const pub = localParticipant.getTrackPublication(Track.Source.Camera);
  if (pub?.track) {
    await localParticipant.unpublishTrack(pub.track);
  }
  await localParticipant.publishTrack(lkTrack, {
    source: Track.Source.Camera,
    name: 'camera-filtered',
  });

  const loop = async () => {
    if (stopped) return;
    const now = performance.now();
    if (now - lastFrame >= 1000 / maxFps) {
      lastFrame = now;
      if (video.videoWidth) syncSize();
      const filter = getFilterDef(filterId);
      if (filterId === 'none') {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        detected = true;
      } else if (filter?.background) {
        detected = true;
        renderFaceFilterFrame(ctx, video, null, filter);
      } else {
        const box = await engine.detect(video, mirrored);
        detected = !!box;
        renderFaceFilterFrame(ctx, video, box, filter, {
          beauty: filterId === 'beauty' || filterId === 'smoothSkin' || !!filter?.beauty,
        });
      }
    }
    raf = requestAnimationFrame(() => void loop());
  };
  raf = requestAnimationFrame(() => void loop());

  return {
    setFilter: (id) => {
      filterId = id;
    },
    faceDetected: () => detected,
    stop: async () => {
      stopped = true;
      cancelAnimationFrame(raf);
      try {
        await localParticipant.unpublishTrack(lkTrack);
      } catch {
        /* ignore */
      }
      lkTrack.stop();
      processedMedia.stop();
      camTrack.stop();
      video.srcObject = null;
      // Re-enable normal camera
      try {
        await localParticipant.setCameraEnabled(true);
      } catch {
        /* ignore */
      }
    },
  };
}
