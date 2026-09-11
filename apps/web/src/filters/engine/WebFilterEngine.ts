import type { Track, TrackProcessor, VideoProcessorOptions } from 'livekit-client';
import {
  DEFAULT_BEAUTY,
  clampBeauty,
  filterRegistry,
  mergeBeauty,
  type BeautySettings,
  type FilterDefinition,
  type FilterEngine,
  type FilterEngineStatus,
  type PlatformCapabilities,
} from '@kushlov/filter-core';
import { FaceTracker } from './FaceTracker';
import { GLRenderer } from '../webgl/GLRenderer';

export type FilterEngineStats = {
  fps: number;
  faces: number;
  trackingMs: number;
  renderMs: number;
  filterId: string;
  webgl: boolean;
  width: number;
  height: number;
};

const WEB_REGISTRY = filterRegistry.forPlatform('web');

const TARGET_FPS = 30;
const FRAME_BUDGET_MS = 1000 / TARGET_FPS;

/**
 * Browser filter engine, implemented as a LiveKit `TrackProcessor`.
 *
 * Using the processor API rather than unpublish/republish means the camera is
 * opened once, the RTCRtpSender keeps the same publication, and no
 * renegotiation happens when a filter is switched on or off. LiveKit swaps the
 * sender's MediaStreamTrack to our canvas capture and hands the local preview
 * the same stream.
 */
export class WebFilterEngine implements FilterEngine, TrackProcessor<Track.Kind.Video> {
  readonly name = 'kushlov-filters';

  processedTrack?: MediaStreamTrack;

  private tracker = new FaceTracker();
  private renderer: GLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private video: HTMLVideoElement | null = null;
  private sourceTrack: MediaStreamTrack | null = null;
  private captureStream: MediaStream | null = null;

  private rafId = 0;
  private timerId = 0;
  private lastFrameAt = 0;

  private filter: FilterDefinition | null = null;
  private userBeauty: BeautySettings = { ...DEFAULT_BEAUTY };
  private effectiveBeauty: BeautySettings = { ...DEFAULT_BEAUTY };

  private state: FilterEngineStatus = 'idle';
  private stats: FilterEngineStats = {
    fps: 0,
    faces: 0,
    trackingMs: 0,
    renderMs: 0,
    filterId: 'none',
    webgl: false,
    width: 0,
    height: 0,
  };
  private frameCount = 0;
  private fpsWindowStart = 0;

  private onStatus?: (status: FilterEngineStatus) => void;

  constructor(options?: { onStatus?: (status: FilterEngineStatus) => void }) {
    this.onStatus = options?.onStatus;
  }

  get status(): FilterEngineStatus {
    return this.state;
  }

  get capabilities(): PlatformCapabilities {
    return {
      faceTracking: this.tracker.available,
      gpuRendering: this.renderer !== null,
      maxFaces: 1,
    };
  }

  getStats(): FilterEngineStats {
    return { ...this.stats };
  }

  /** Warms the MediaPipe model. Safe to call before a call starts. */
  async initialize(): Promise<void> {
    if (this.state === 'running' || this.state === 'paused') return;
    this.setStatus('initializing');
    await this.tracker.initialize();
  }

  // --- LiveKit TrackProcessor ------------------------------------------------

  async init(opts: VideoProcessorOptions): Promise<void> {
    await this.attach(opts.track);
  }

  async restart(opts: VideoProcessorOptions): Promise<void> {
    // Fires on camera device switch. Re-point at the new source but keep the
    // renderer, model and selected filter so the swap is not visible.
    this.teardownSource();
    await this.attach(opts.track);
  }

  async destroy(): Promise<void> {
    this.stop();
    this.teardownSource();
    this.renderer?.dispose();
    this.renderer = null;
    this.tracker.dispose();
    this.canvas = null;
    this.processedTrack = undefined;
    this.setStatus('idle');
  }

  // --- FilterEngine ----------------------------------------------------------

  start(): void {
    if (!this.video || !this.renderer) return;
    if (this.state === 'running') return;
    this.setStatus('running');
    this.lastFrameAt = 0;
    this.fpsWindowStart = performance.now();
    this.frameCount = 0;
    this.schedule();
  }

  stop(): void {
    this.cancelScheduled();
    if (this.state === 'running' || this.state === 'paused') this.setStatus('idle');
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.cancelScheduled();
    this.setStatus('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.setStatus('running');
    this.schedule();
  }

  loadFilter(id: string): void {
    const next = WEB_REGISTRY.get(id);
    this.filter = next && next.kind !== 'none' ? next : null;
    this.stats.filterId = this.filter?.id ?? 'none';
    this.recomputeBeauty();
    if (!this.filter) this.tracker.reset();
  }

  removeFilter(): void {
    this.loadFilter('none');
  }

  setBeauty(settings: Partial<BeautySettings>): void {
    this.userBeauty = clampBeauty({ ...this.userBeauty, ...settings });
    this.recomputeBeauty();
  }

  getBeauty(): BeautySettings {
    return { ...this.userBeauty };
  }

  // --- internals -------------------------------------------------------------

  private setStatus(status: FilterEngineStatus): void {
    if (this.state === status) return;
    this.state = status;
    this.onStatus?.(status);
  }

  /**
   * A filter's own beauty preset wins over the manual sliders while it is
   * selected, so picking "Smooth Skin" visibly does something even when the
   * user has never touched the sliders.
   */
  private recomputeBeauty(): void {
    this.effectiveBeauty = mergeBeauty(this.userBeauty, this.filter?.beauty);
  }

  private async attach(track: MediaStreamTrack): Promise<void> {
    this.sourceTrack = track;

    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.srcObject = new MediaStream([track]);
    this.video = video;

    try {
      await video.play();
    } catch {
      // Autoplay of a muted, srcObject-backed element is permitted, but a
      // rejection here must not take the call down.
    }

    const settings = track.getSettings();
    const width = settings.width ?? video.videoWidth ?? 1280;
    const height = settings.height ?? video.videoHeight ?? 720;

    const canvas = this.canvas ?? document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    this.canvas = canvas;

    if (!this.renderer) {
      this.renderer = GLRenderer.create(canvas);
    }
    this.stats.webgl = this.renderer !== null;
    this.stats.width = width;
    this.stats.height = height;
    this.renderer?.resize(width, height);

    if (!this.tracker.available) await this.tracker.initialize();

    if (!this.processedTrack) {
      this.captureStream = canvas.captureStream(TARGET_FPS);
      this.processedTrack = this.captureStream.getVideoTracks()[0];
    }

    this.start();
  }

  private teardownSource(): void {
    this.cancelScheduled();
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    // The source track belongs to LiveKit; stopping it here would kill the
    // camera for the whole call.
    this.sourceTrack = null;
    this.tracker.reset();
    if (this.captureStream) {
      for (const track of this.captureStream.getTracks()) track.stop();
      this.captureStream = null;
    }
  }

  private cancelScheduled(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = 0;
    }
  }

  /**
   * rAF while the tab is visible. Hidden tabs stop firing rAF entirely, which
   * would freeze the published canvas, so fall back to a timer — throttled by
   * the browser, but a slow stream beats a frozen one.
   */
  private schedule(): void {
    if (this.state !== 'running') return;
    this.cancelScheduled();
    if (typeof document !== 'undefined' && document.hidden) {
      this.timerId = window.setTimeout(() => this.frame(), FRAME_BUDGET_MS);
    } else {
      this.rafId = requestAnimationFrame(() => this.frame());
    }
  }

  private frame(): void {
    this.rafId = 0;
    this.timerId = 0;
    if (this.state !== 'running') return;

    const video = this.video;
    const renderer = this.renderer;
    if (!video || !renderer) {
      this.schedule();
      return;
    }

    const now = performance.now();
    if (now - this.lastFrameAt < FRAME_BUDGET_MS - 1) {
      this.schedule();
      return;
    }
    this.lastFrameAt = now;

    if (video.videoWidth && video.videoWidth !== this.stats.width) {
      this.stats.width = video.videoWidth;
      this.stats.height = video.videoHeight;
      if (this.canvas) {
        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;
      }
      renderer.resize(video.videoWidth, video.videoHeight);
    }

    // Tracking only matters for accessories; colour and beauty passes are
    // full-frame, so skip the model entirely when nothing is anchored.
    const needsFace = Boolean(this.filter?.sprites?.length) || this.effectiveBeauty.skinSmoothing > 0.001;
    const trackStart = performance.now();
    const face = needsFace ? this.tracker.update(video, trackStart) : null;
    const trackEnd = performance.now();

    renderer.render(video, face, this.filter, this.effectiveBeauty);
    const renderEnd = performance.now();

    this.stats.trackingMs = trackEnd - trackStart;
    this.stats.renderMs = renderEnd - trackEnd;
    this.stats.faces = face?.detected ? 1 : 0;

    this.frameCount += 1;
    if (renderEnd - this.fpsWindowStart >= 1000) {
      this.stats.fps = Math.round((this.frameCount * 1000) / (renderEnd - this.fpsWindowStart));
      this.frameCount = 0;
      this.fpsWindowStart = renderEnd;
    }

    this.schedule();
  }
}

export { WEB_REGISTRY };
