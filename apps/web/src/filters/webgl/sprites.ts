import type { SpriteId } from '@kushlov/filter-core';

/**
 * Accessory artwork.
 *
 * Each sprite is painted once with Canvas2D vector calls into an offscreen
 * bitmap and uploaded as a GPU texture. Per frame the renderer only draws a
 * textured quad, so there is no CPU drawing in the hot path and no binary
 * image assets to ship or cache-bust.
 *
 * All painters work in a fixed 220x90 design space; the renderer stretches
 * that to whatever the tracked anchor box is.
 */

const DESIGN_W = 220;
const DESIGN_H = 90;
/** Supersample so edges stay clean when a sprite is scaled up on a big face. */
const SCALE = 3;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.35);
  ctx.bezierCurveTo(cx - size, cy - size * 0.2, cx - size * 0.5, cy - size, cx, cy - size * 0.35);
  ctx.bezierCurveTo(cx + size * 0.5, cy - size, cx + size, cy - size * 0.2, cx, cy + size * 0.35);
  ctx.fill();
}

const PAINTERS: Record<SpriteId, (ctx: CanvasRenderingContext2D) => void> = {
  sunglasses(ctx) {
    ctx.fillStyle = '#111';
    roundRect(ctx, 18, 24, 80, 42, 16);
    ctx.fill();
    roundRect(ctx, 122, 24, 80, 42, 16);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(98, 44);
    ctx.lineTo(122, 44);
    ctx.stroke();
    ctx.fillStyle = 'rgba(61,74,92,0.45)';
    roundRect(ctx, 24, 30, 68, 16, 8);
    ctx.fill();
    roundRect(ctx, 128, 30, 68, 16, 8);
    ctx.fill();
  },
  aviator(ctx) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(66, 46, 42, 28, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(154, 46, 42, 28, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(100, 40);
    ctx.lineTo(120, 40);
    ctx.stroke();
  },
  heartGlasses(ctx) {
    ctx.fillStyle = '#ec4899';
    heart(ctx, 70, 48, 42);
    heart(ctx, 150, 48, 42);
  },
  rainbowGlasses(ctx) {
    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'];
    colors.forEach((color, i) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 7 - i;
      roundRect(ctx, 18 + i * 2, 24 + i * 2, 82 - i * 4, 44 - i * 4, 16);
      ctx.stroke();
      roundRect(ctx, 120 + i * 2, 24 + i * 2, 82 - i * 4, 44 - i * 4, 16);
      ctx.stroke();
    });
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(100, 46);
    ctx.lineTo(120, 46);
    ctx.stroke();
  },
  animeEyes(ctx) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 5;
    for (const cx of [70, 150]) {
      ctx.beginPath();
      ctx.ellipse(cx, 46, 38, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#2563eb';
    for (const cx of [76, 156]) {
      ctx.beginPath();
      ctx.arc(cx, 50, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    for (const cx of [80, 160]) {
      ctx.beginPath();
      ctx.arc(cx, 44, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    for (const cx of [68, 148]) {
      ctx.beginPath();
      ctx.arc(cx, 40, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  laserEyes(ctx) {
    ctx.fillStyle = '#ef4444';
    for (const cx of [70, 150]) {
      ctx.beginPath();
      ctx.arc(cx, 30, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(70, 44);
    ctx.lineTo(58, 86);
    ctx.moveTo(150, 44);
    ctx.lineTo(162, 86);
    ctx.stroke();
  },
  medicalMask(ctx) {
    ctx.fillStyle = '#e8f4ff';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(110, 52, 88, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },
  mustache(ctx) {
    ctx.fillStyle = '#3f2a1d';
    ctx.beginPath();
    ctx.ellipse(70, 52, 48, 18, -0.2, 0, Math.PI * 2);
    ctx.ellipse(150, 52, 48, 18, 0.2, 0, Math.PI * 2);
    ctx.fill();
  },
  dogEars(ctx) {
    ctx.fillStyle = '#c47a3a';
    ctx.beginPath();
    ctx.ellipse(52, 48, 28, 50, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(168, 48, 28, 50, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3c6a0';
    ctx.beginPath();
    ctx.ellipse(56, 52, 12, 28, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(164, 52, 12, 28, 0.4, 0, Math.PI * 2);
    ctx.fill();
  },
  dogNose(ctx) {
    ctx.fillStyle = '#3f2a1d';
    ctx.beginPath();
    ctx.ellipse(110, 40, 36, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  catEars(ctx) {
    ctx.fillStyle = '#f4b942';
    ctx.beginPath();
    ctx.moveTo(36, 86);
    ctx.lineTo(56, 8);
    ctx.lineTo(108, 70);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(184, 86);
    ctx.lineTo(164, 8);
    ctx.lineTo(112, 70);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f8c9d4';
    ctx.beginPath();
    ctx.moveTo(50, 74);
    ctx.lineTo(62, 24);
    ctx.lineTo(92, 66);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(170, 74);
    ctx.lineTo(158, 24);
    ctx.lineTo(128, 66);
    ctx.closePath();
    ctx.fill();
  },
  catNose(ctx) {
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.moveTo(110, 24);
    ctx.lineTo(132, 52);
    ctx.lineTo(88, 52);
    ctx.closePath();
    ctx.fill();
  },
  catWhiskers(ctx) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, 36);
    ctx.lineTo(90, 40);
    ctx.moveTo(20, 52);
    ctx.lineTo(90, 52);
    ctx.moveTo(20, 68);
    ctx.lineTo(90, 64);
    ctx.moveTo(200, 36);
    ctx.lineTo(130, 40);
    ctx.moveTo(200, 52);
    ctx.lineTo(130, 52);
    ctx.moveTo(200, 68);
    ctx.lineTo(130, 64);
    ctx.stroke();
  },
  bunnyEars(ctx) {
    ctx.fillStyle = '#f8f4ef';
    ctx.strokeStyle = '#e8d9c8';
    ctx.lineWidth = 3;
    for (const cx of [70, 150]) {
      ctx.beginPath();
      ctx.ellipse(cx, 48, 24, 48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#f9c5d5';
    for (const cx of [70, 150]) {
      ctx.beginPath();
      ctx.ellipse(cx, 52, 10, 32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  crown(ctx) {
    ctx.fillStyle = '#f4c430';
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, 72);
    ctx.lineTo(44, 18);
    ctx.lineTo(78, 56);
    ctx.lineTo(110, 8);
    ctx.lineTo(142, 56);
    ctx.lineTo(176, 18);
    ctx.lineTo(200, 72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const gems: [number, number, string][] = [
      [44, 18, '#ef4444'],
      [110, 8, '#38bdf8'],
      [176, 18, '#22c55e'],
    ];
    for (const [cx, cy, color] of gems) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, cy === 8 ? 9 : 8, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  flowerCrown(ctx) {
    const blooms: [number, number, string][] = [
      [40, 58, '#fb7185'],
      [88, 38, '#f472b6'],
      [132, 38, '#fb7185'],
      [180, 58, '#f9a8d4'],
    ];
    for (const [cx, cy, color] of blooms) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  devilHorns(ctx) {
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(40, 82);
    ctx.quadraticCurveTo(28, 20, 86, 48);
    ctx.quadraticCurveTo(50, 70, 40, 82);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(180, 82);
    ctx.quadraticCurveTo(192, 20, 134, 48);
    ctx.quadraticCurveTo(170, 70, 180, 82);
    ctx.fill();
  },
  clownNose(ctx) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(110, 45, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fecaca';
    ctx.beginPath();
    ctx.arc(98, 34, 8, 0, Math.PI * 2);
    ctx.fill();
  },
  robotVisor(ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    roundRect(ctx, 22, 22, 176, 48, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#22d3ee';
    roundRect(ctx, 36, 34, 60, 24, 6);
    ctx.fill();
    roundRect(ctx, 124, 34, 60, 24, 6);
    ctx.fill();
  },
  robotJaw(ctx) {
    ctx.fillStyle = '#334155';
    roundRect(ctx, 50, 28, 120, 42, 10);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    roundRect(ctx, 62, 42, 96, 10, 4);
    ctx.fill();
  },
  anonMask(ctx) {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(110, 46, 90, 38, 0, 0, Math.PI * 2);
    ctx.fill();
  },
};

/** Rasterise one sprite. Returns null when Canvas2D is unavailable. */
export function paintSprite(id: SpriteId): HTMLCanvasElement | null {
  const painter = PAINTERS[id];
  if (!painter) return null;

  const canvas = document.createElement('canvas');
  canvas.width = DESIGN_W * SCALE;
  canvas.height = DESIGN_H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(SCALE, SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  painter(ctx);
  return canvas;
}

export const SPRITE_IDS = Object.keys(PAINTERS) as SpriteId[];
