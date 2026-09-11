type Segmenter = {
  segmentForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { confidenceMasks?: { getAsFloat32Array: () => Float32Array; width: number; height: number }[]; close?: () => void };
  close?: () => void;
};

let segmenterPromise: Promise<Segmenter | null> | null = null;

async function createSegmenter(): Promise<Segmenter | null> {
  try {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    );
    return (await vision.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })) as unknown as Segmenter;
  } catch {
    // No WebGL, blocked CDN, or an unsupported browser — callers fall back to
    // an unsegmented background rather than losing the video.
    return null;
  }
}

export function getSelfieSegmenter() {
  if (!segmenterPromise) segmenterPromise = createSegmenter();
  return segmenterPromise;
}

/**
 * Produces a person-shaped alpha mask from the camera frame, reusing one canvas
 * so a 30fps call does not allocate a bitmap per frame.
 *
 * The mask is deliberately kept at the model's own resolution and scaled up at
 * draw time — upsampling here would cost more than the softer edge is worth.
 */
export class SelfieSegmentationEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;
  private lastTs = 0;
  private ready = false;

  /** Null until the model has produced a usable mask. */
  mask(): HTMLCanvasElement | null {
    return this.ready ? this.canvas : null;
  }

  /**
   * Refreshes the cached mask. Throttled, and safe to call every frame: a stale
   * mask for a frame or two is invisible next to dropping the video.
   */
  async update(video: HTMLVideoElement): Promise<void> {
    if (video.readyState < 2 || !video.videoWidth) return;
    const now = performance.now();
    if (now - this.lastTs < 40) return;
    this.lastTs = now;

    const segmenter = await getSelfieSegmenter();
    if (!segmenter) return;

    try {
      const result = segmenter.segmentForVideo(video, now);
      const confidence = result.confidenceMasks?.[0];
      if (!confidence) return;

      const width = confidence.width;
      const height = confidence.height;
      const values = confidence.getAsFloat32Array();
      if (!width || !height || values.length < width * height) return;

      if (!this.canvas || this.canvas.width !== width || this.canvas.height !== height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.image = this.ctx?.createImageData(width, height) ?? null;
      }
      const ctx = this.ctx;
      const image = this.image;
      if (!ctx || !image) return;

      const data = image.data;
      for (let i = 0; i < width * height; i += 1) {
        const alpha = values[i];
        const offset = i * 4;
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
        data[offset + 3] = alpha > 0.999 ? 255 : alpha < 0.001 ? 0 : Math.round(alpha * 255);
      }
      ctx.putImageData(image, 0, 0);
      this.ready = true;
      result.close?.();
    } catch {
      /* keep the previous mask */
    }
  }

  reset() {
    this.ready = false;
  }
}
