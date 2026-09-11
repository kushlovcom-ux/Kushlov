import type { FaceBox, FaceFilterDef } from '../types';
import { layoutFilter, layoutFilterLayers } from '../layout';
import { drawFilterLayer } from './drawFilterLayers';

/** Draw camera frame + privacy FX / sticker onto canvas (normalized face box 0–1). */
export function renderFaceFilterFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  box: FaceBox | null,
  filter: FaceFilterDef | null,
  opts?: { beauty?: boolean; mask?: CanvasImageSource | null },
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.drawImage(video, 0, 0, w, h);

  if (opts?.beauty || filter?.beauty) {
    applyBeauty(ctx, video, w, h, box);
  }

  if (filter?.background) {
    applyBackground(ctx, w, h, filter.background, opts?.mask ?? null);
    return;
  }

  if (!filter || !box) return;

  const layout = layoutFilter(box, filter, w, h);

  if (filter.privacy) {
    applyPrivacy(
      ctx,
      layout.x - layout.w / 2,
      layout.y - layout.h / 2,
      layout.w,
      layout.h,
      filter.privacy,
      layout.rotation,
    );
  }

  if (filter.layers?.length) {
    for (const layer of layoutFilterLayers(box, filter, w, h)) {
      drawFilterLayer(ctx, layer.kind, layer);
    }
    return;
  }

  if (filter.emoji && filter.emoji !== '✕' && !filter.beauty) {
    ctx.save();
    ctx.translate(layout.x, layout.y);
    ctx.rotate((layout.rotation * Math.PI) / 180);
    ctx.font = `${Math.round(layout.fontSize)}px "Segoe UI Emoji", "Apple Color Emoji", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.fillText(filter.emoji, 0, 0);
    ctx.restore();
  }
}

function applyPrivacy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mode: 'pixel' | 'mosaic' | 'blur' | 'solid',
  rotation = 0,
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const ix = Math.max(0, Math.floor(x));
  const iy = Math.max(0, Math.floor(y));
  const iw = Math.max(1, Math.floor(w));
  const ih = Math.max(1, Math.floor(h));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);

  if (mode === 'solid') {
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.clip();
  ctx.rotate((-rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  if (mode === 'blur') {
    ctx.filter = 'blur(16px)';
    ctx.drawImage(ctx.canvas, ix, iy, iw, ih, ix - 8, iy - 8, iw + 16, ih + 16);
    ctx.restore();
    return;
  }

  const block = mode === 'mosaic' ? 14 : 10;
  try {
    const img = ctx.getImageData(ix, iy, iw, ih);
    const data = img.data;
    for (let py = 0; py < ih; py += block) {
      for (let px = 0; px < iw; px += block) {
        const i = ((py * iw + px) * 4) | 0;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        for (let by = 0; by < block && py + by < ih; by++) {
          for (let bx = 0; bx < block && px + bx < iw; bx++) {
            const j = (((py + by) * iw + (px + bx)) * 4) | 0;
            data[j] = r;
            data[j + 1] = g;
            data[j + 2] = b;
          }
        }
      }
    }
    ctx.putImageData(img, ix, iy);
  } catch {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(ix, iy, iw, ih);
  }
  ctx.restore();
}

/**
 * Skin smoothing. A blurred copy is blended back only inside the face, so skin
 * softens while the rest of the frame keeps its detail — blurring everything
 * reads as a dirty lens rather than a beauty filter. Falls back to a whole-frame
 * soft focus when the face has not been located yet.
 */
function applyBeauty(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
  box: FaceBox | null,
) {
  ctx.save();
  if (box) {
    ctx.beginPath();
    ctx.ellipse(box.cx * w, box.cy * h, (box.width * w) / 1.7, (box.height * h) / 1.6, 0, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.globalAlpha = 0.55;
  ctx.filter = `blur(${Math.max(2, Math.round(Math.min(w, h) / 140))}px) brightness(1.07) saturate(1.06)`;
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();

  // A touch of the original back on top keeps eyes and lips from going soft.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.filter = 'contrast(1.06)';
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
}

/** Scratch canvases reused across frames so compositing does not allocate. */
let bgLayer: HTMLCanvasElement | null = null;
let personLayer: HTMLCanvasElement | null = null;

function scratch(which: 'bg' | 'person', w: number, h: number) {
  let canvas = which === 'bg' ? bgLayer : personLayer;
  if (!canvas) {
    canvas = document.createElement('canvas');
    if (which === 'bg') bgLayer = canvas;
    else personLayer = canvas;
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return canvas;
}

function applyBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: NonNullable<FaceFilterDef['background']>,
  mask: CanvasImageSource | null,
) {
  // With a person mask we can treat only the background and composite the
  // subject back on top. Without one we keep the previous whole-frame look,
  // which still reads as an effect on browsers that cannot run segmentation.
  if (mask) {
    const background = scratch('bg', w, h);
    const bgCtx = background.getContext('2d');
    const person = scratch('person', w, h);
    const personCtx = person.getContext('2d');
    if (bgCtx && personCtx) {
      bgCtx.clearRect(0, 0, w, h);
      bgCtx.drawImage(ctx.canvas, 0, 0, w, h);
      paintBackgroundTreatment(bgCtx, w, h, mode);

      personCtx.clearRect(0, 0, w, h);
      personCtx.drawImage(ctx.canvas, 0, 0, w, h);
      personCtx.save();
      personCtx.globalCompositeOperation = 'destination-in';
      personCtx.drawImage(mask, 0, 0, w, h);
      personCtx.restore();

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(background, 0, 0, w, h);
      ctx.drawImage(person, 0, 0, w, h);
      return;
    }
  }
  paintBackgroundTreatment(ctx, w, h, mode);
}

function paintBackgroundTreatment(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: NonNullable<FaceFilterDef['background']>,
) {
  ctx.save();
  if (mode === 'blur') {
    ctx.filter = 'blur(18px) brightness(0.78)';
    ctx.drawImage(ctx.canvas, 0, 0, w, h);
    ctx.filter = 'none';
    const fade = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.12, w * 0.5, h * 0.45, w * 0.72);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(8,8,16,0.55)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  const grd = ctx.createLinearGradient(0, 0, w, h);
  if (mode === 'dim') {
    grd.addColorStop(0, 'rgba(0,0,0,0.28)');
    grd.addColorStop(1, 'rgba(0,0,0,0.62)');
  } else if (mode === 'sunset') {
    grd.addColorStop(0, 'rgba(255,126,95,0.42)');
    grd.addColorStop(1, 'rgba(80,20,60,0.5)');
  } else if (mode === 'night') {
    grd.addColorStop(0, 'rgba(10,22,56,0.48)');
    grd.addColorStop(1, 'rgba(2,6,18,0.72)');
  } else if (mode === 'studio') {
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(18,18,24,0.5)');
  } else {
    grd.addColorStop(0, 'rgba(236,72,153,0.38)');
    grd.addColorStop(1, 'rgba(34,211,238,0.32)');
  }
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
