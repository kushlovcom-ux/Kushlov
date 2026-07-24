import type { FaceBox, FaceFilterDef } from '../types';

/** Draw camera frame + privacy FX / sticker onto canvas (normalized face box 0–1). */
export function renderFaceFilterFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  box: FaceBox | null,
  filter: FaceFilterDef | null,
  opts?: { beauty?: boolean },
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.drawImage(video, 0, 0, w, h);

  if (opts?.beauty || filter?.beauty) {
    ctx.save();
    ctx.filter = 'brightness(1.06) contrast(1.04) saturate(1.08)';
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
  }

  if (!filter || !box) return;

  const fx = box.cx * w;
  const fy = box.cy * h;
  const fw = box.width * w * filter.scale;
  const fh = box.height * h * filter.scale;
  const yOff = (filter.yOffset ?? 0) * box.height * h;

  if (filter.privacy) {
    const x = fx - fw / 2;
    const y = fy - fh / 2 + yOff;
    applyPrivacy(ctx, x, y, fw, fh, filter.privacy);
  }

  if (filter.emoji && filter.emoji !== '✕' && !filter.beauty) {
    ctx.save();
    ctx.translate(fx, fy + yOff);
    ctx.rotate((box.rotation * Math.PI) / 180);
    const size = Math.max(fw, fh);
    ctx.font = `${Math.round(size * 0.95)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
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
) {
  const ix = Math.max(0, Math.floor(x));
  const iy = Math.max(0, Math.floor(y));
  const iw = Math.max(1, Math.floor(w));
  const ih = Math.max(1, Math.floor(h));

  if (mode === 'solid') {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (mode === 'blur') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = 'blur(14px)';
    ctx.drawImage(ctx.canvas, ix, iy, iw, ih, ix, iy, iw, ih);
    ctx.restore();
    return;
  }

  // pixel / mosaic
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
}
