import type { FilterLayerKind } from '../types';
import type { FilterLayout } from '../layout';

/** Draw original vector AR parts onto the processed camera canvas. */
export function drawFilterLayer(
  ctx: CanvasRenderingContext2D,
  kind: FilterLayerKind,
  layout: FilterLayout,
) {
  const { x, y, w, h, rotation } = layout;
  if (w < 4 || h < 4) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.scale(w / 220, h / 90);
  paint(ctx, kind);
  ctx.restore();
}

function paint(ctx: CanvasRenderingContext2D, kind: FilterLayerKind) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const roundRect = (x: number, y: number, rw: number, rh: number, r: number) => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, rw, rh, r);
      return;
    }
    const radius = Math.min(r, rw / 2, rh / 2);
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, radius);
    ctx.arcTo(x + rw, y + rh, x, y + rh, radius);
    ctx.arcTo(x, y + rh, x, y, radius);
    ctx.arcTo(x, y, x + rw, y, radius);
    ctx.closePath();
  };

  switch (kind) {
    case 'sunglasses': {
      ctx.fillStyle = '#111';
      roundRect(18, 24, 80, 42, 16);
      ctx.fill();
      roundRect(122, 24, 80, 42, 16);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(98, 44);
      ctx.lineTo(122, 44);
      ctx.stroke();
      ctx.fillStyle = 'rgba(61,74,92,0.45)';
      roundRect(24, 30, 68, 16, 8);
      ctx.fill();
      roundRect(128, 30, 68, 16, 8);
      ctx.fill();
      break;
    }
    case 'aviator': {
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
      break;
    }
    case 'heartGlasses': {
      ctx.fillStyle = '#ec4899';
      heart(ctx, 70, 48, 42);
      heart(ctx, 150, 48, 42);
      break;
    }
    case 'rainbowGlasses': {
      const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'];
      colors.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 7 - i;
        roundRect(18 + i * 2, 24 + i * 2, 82 - i * 4, 44 - i * 4, 16);
        ctx.stroke();
        roundRect(120 + i * 2, 24 + i * 2, 82 - i * 4, 44 - i * 4, 16);
        ctx.stroke();
      });
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(100, 46);
      ctx.lineTo(120, 46);
      ctx.stroke();
      break;
    }
    case 'animeEyes': {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(70, 46, 38, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(150, 46, 38, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(76, 50, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(156, 50, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(80, 44, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(160, 44, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(68, 40, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(148, 40, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'laserEyes': {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(70, 30, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(150, 30, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(70, 44);
      ctx.lineTo(58, 86);
      ctx.moveTo(150, 44);
      ctx.lineTo(162, 86);
      ctx.stroke();
      break;
    }
    case 'medicalMask': {
      ctx.fillStyle = '#e8f4ff';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(110, 52, 88, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'mustache': {
      ctx.fillStyle = '#3f2a1d';
      ctx.beginPath();
      ctx.ellipse(70, 52, 48, 18, -0.2, 0, Math.PI * 2);
      ctx.ellipse(150, 52, 48, 18, 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'dogEars': {
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
      break;
    }
    case 'dogNose': {
      ctx.fillStyle = '#3f2a1d';
      ctx.beginPath();
      ctx.ellipse(110, 40, 36, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'catEars': {
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
      break;
    }
    case 'catNose': {
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.moveTo(110, 24);
      ctx.lineTo(132, 52);
      ctx.lineTo(88, 52);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'catWhiskers': {
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
      break;
    }
    case 'bunnyEars': {
      ctx.fillStyle = '#f8f4ef';
      ctx.strokeStyle = '#e8d9c8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(70, 48, 24, 48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(150, 48, 24, 48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f9c5d5';
      ctx.beginPath();
      ctx.ellipse(70, 52, 10, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(150, 52, 10, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'crown': {
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
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(44, 18, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(110, 8, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(176, 18, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'flowerCrown': {
      const blooms = [
        [40, 58, '#fb7185'],
        [88, 38, '#f472b6'],
        [132, 38, '#fb7185'],
        [180, 58, '#f9a8d4'],
      ] as const;
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
      break;
    }
    case 'devilHorns': {
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
      break;
    }
    case 'clownNose': {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(110, 45, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fecaca';
      ctx.beginPath();
      ctx.arc(98, 34, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'robotVisor': {
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      roundRect(22, 22, 176, 48, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#22d3ee';
      roundRect(36, 34, 60, 24, 6);
      ctx.fill();
      roundRect(124, 34, 60, 24, 6);
      ctx.fill();
      break;
    }
    case 'robotJaw': {
      ctx.fillStyle = '#334155';
      roundRect(50, 28, 120, 42, 10);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      roundRect(62, 42, 96, 10, 4);
      ctx.fill();
      break;
    }
    case 'anonMask': {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(110, 46, 90, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      break;
  }
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.35);
  ctx.bezierCurveTo(cx - size, cy - size * 0.2, cx - size * 0.5, cy - size, cx, cy - size * 0.35);
  ctx.bezierCurveTo(cx + size * 0.5, cy - size, cx + size, cy - size * 0.2, cx, cy + size * 0.35);
  ctx.fill();
}
