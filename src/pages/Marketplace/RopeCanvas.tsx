// src/pages/Marketplace/RopeCanvas.tsx

import { useEffect, useRef } from 'react';

interface Shape {
  name:   string;
  points: (w: number, h: number) => [number, number][];
}

const SHAPES: Shape[] = [
  {
    name: 'Shopping Cart',
    points: (w, h) => {
      const pts: [number, number][] = [];
      const cx = w * 0.5;
      const cy = h * 0.5;
      const s  = Math.min(w, h) * 0.28;
      // Handle
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.6 + t * s * 0.3, cy - s * 0.7]);
      // Arc over handle
      for (let t = 0; t <= 1; t += 0.02) {
        const a = Math.PI + t * Math.PI;
        pts.push([cx - s * 0.1 + Math.cos(a) * s * 0.25, cy - s * 0.55 + Math.sin(a) * s * 0.2]);
      }
      // Right of handle
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.15 + t * s * 0.1, cy - s * 0.7]);
      // Right wall down
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.65, cy - s * 0.7 + t * s * 0.7]);
      // Bottom
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.65 - t * s * 1.3, cy]);
      // Left wall up
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.65, cy - t * s * 0.7]);
      // Left wheel
      for (let t = 0; t <= 1; t += 0.02) {
        const a = t * Math.PI * 2;
        pts.push([cx - s * 0.35 + Math.cos(a) * s * 0.13, cy + s * 0.22 + Math.sin(a) * s * 0.13]);
      }
      // Right wheel
      for (let t = 0; t <= 1; t += 0.02) {
        const a = t * Math.PI * 2;
        pts.push([cx + s * 0.35 + Math.cos(a) * s * 0.13, cy + s * 0.22 + Math.sin(a) * s * 0.13]);
      }
      return pts;
    },
  },
  {
    name: 'Naira ₦',
    points: (w, h) => {
      const pts: [number, number][] = [];
      const cx = w * 0.5;
      const cy = h * 0.5;
      const s  = Math.min(w, h) * 0.3;
      // Left vertical
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.4, cy + s * 0.7 - t * s * 1.4]);
      // Diagonal right
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.4 + t * s * 0.8, cy - s * 0.7 + t * s * 1.4]);
      // Right vertical down
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.4, cy + s * 0.7 - t * s * 1.4]);
      // Cross bar 1
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.5 + t * s * 1.0, cy - s * 0.1]);
      // Cross bar 2
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.5 - t * s * 1.0, cy + s * 0.2]);
      return pts;
    },
  },
  {
    name: 'Shopping Bag',
    points: (w, h) => {
      const pts: [number, number][] = [];
      const cx = w * 0.5;
      const cy = h * 0.5;
      const s  = Math.min(w, h) * 0.3;
      // Bag body rectangle
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.6 + t * s * 1.2, cy - s * 0.5]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.6, cy - s * 0.5 + t * s * 1.0]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.6 - t * s * 1.2, cy + s * 0.5]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.6, cy + s * 0.5 - t * s * 1.0]);
      // Left handle arc
      for (let t = 0; t <= 1; t += 0.02) {
        const a = Math.PI + t * Math.PI;
        pts.push([cx - s * 0.22 + Math.cos(a) * s * 0.18, cy - s * 0.6 + Math.sin(a) * s * 0.22]);
      }
      // Right handle arc
      for (let t = 0; t <= 1; t += 0.02) {
        const a = Math.PI + t * Math.PI;
        pts.push([cx + s * 0.22 + Math.cos(a) * s * 0.18, cy - s * 0.6 + Math.sin(a) * s * 0.22]);
      }
      return pts;
    },
  },
  {
    name: 'Store',
    points: (w, h) => {
      const pts: [number, number][] = [];
      const cx = w * 0.5;
      const cy = h * 0.5;
      const s  = Math.min(w, h) * 0.3;
      // Roof left to peak
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.8 + t * s * 0.8, cy - s * 0.3 - t * s * 0.4]);
      // Roof peak to right
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + t * s * 0.8, cy - s * 0.7 + t * s * 0.4]);
      // Right wall down
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.8, cy - s * 0.3 + t * s * 1.0]);
      // Ground line left
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.8 - t * s * 1.6, cy + s * 0.7]);
      // Left wall up
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.8, cy + s * 0.7 - t * s * 1.0]);
      // Door
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.2 + t * s * 0.4, cy + s * 0.7]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.2, cy + s * 0.7 - t * s * 0.5]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.2 + t * s * 0.4, cy + s * 0.2]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.2, cy + s * 0.2 + t * s * 0.5]);
      return pts;
    },
  },
  {
    name: 'Package',
    points: (w, h) => {
      const pts: [number, number][] = [];
      const cx = w * 0.5;
      const cy = h * 0.5;
      const s  = Math.min(w, h) * 0.28;
      // Front face
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.6 + t * s * 1.2, cy - s * 0.2]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.6, cy - s * 0.2 + t * s * 0.8]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.6 - t * s * 1.2, cy + s * 0.6]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.6, cy + s * 0.6 - t * s * 0.8]);
      // Top face
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.6 + t * s * 0.5, cy - s * 0.2 - t * s * 0.5]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.1 + t * s * 1.2, cy - s * 0.7]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 1.1 - t * s * 0.5, cy - s * 0.7 + t * s * 0.5]);
      // Right face down
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + s * 0.6 + t * s * 0.5, cy - s * 0.2 - t * s * 0.5 + t * s * 0.8]);
      // Ribbon
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx - s * 0.6 + t * s * 1.2, cy + s * 0.1]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx, cy - s * 0.2 - t * s * 0.5]);
      for (let t = 0; t <= 1; t += 0.02)
        pts.push([cx + t * s * 0.1, cy - s * 0.7 + t * s * 0.5]);
      return pts;
    },
  },
];

// ── Catmull-Rom smoothing ──────────────────────────────────────────────────────

function catmull(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number],
  t: number,
): [number, number] {
  const t2 = t * t, t3 = t2 * t;
  return [
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

function smooth(pts: [number, number][]): [number, number][] {
  if (pts.length < 2) return pts;
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[Math.min(pts.length - 1, i + 1)];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.25)
      out.push(catmull(p0, p1, p2, p3, t));
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RopeCanvas() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const stateRef    = useRef({
    shapeIdx:    0,
    allPts:      [] as [number, number][],
    drawnPts:    [] as [number, number][],
    progress:    0,
    phase:       'draw' as 'draw' | 'hold' | 'fade',
    alpha:       1,
    animId:      0,
    holdTimer:   0,
    label:       '',
    labelAlpha:  0,
    particles:   [] as { x: number; y: number; vx: number; vy: number; life: number }[],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s   = stateRef.current;

    // ── Resize ──
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      startShape();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    function buildShape() {
      return SHAPES[s.shapeIdx].points(canvas!.width, canvas!.height);
    }

    function startShape() {
      cancelAnimationFrame(s.animId);
      clearTimeout(s.holdTimer);
      s.allPts     = buildShape();
      s.drawnPts   = [];
      s.progress   = 0;
      s.phase      = 'draw';
      s.alpha      = 1;
      s.label      = SHAPES[s.shapeIdx].name;
      s.labelAlpha = 0;
      s.particles  = [];
      tick();
    }

    function drawGrid() {
      ctx.save();
      ctx.globalAlpha = 0.03;
      ctx.strokeStyle = '#111827';
      ctx.lineWidth   = 0.5;
      const step = 32;
      for (let x = 0; x < canvas!.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas!.height); ctx.stroke();
      }
      for (let y = 0; y < canvas!.height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas!.width, y); ctx.stroke();
      }
      ctx.restore();
    }

    function drawRope(pts: [number, number][], alpha: number) {
      if (pts.length < 2) return;
      const sm = smooth(pts);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      // Glow
      ctx.beginPath();
      ctx.moveTo(sm[0][0], sm[0][1]);
      sm.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.strokeStyle = 'rgba(249,115,22,0.12)';
      ctx.lineWidth   = 14;
      ctx.stroke();

      // Dark core
      ctx.beginPath();
      ctx.moveTo(sm[0][0], sm[0][1]);
      sm.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.strokeStyle = '#C05408';
      ctx.lineWidth   = 4.5;
      ctx.stroke();

      // Orange
      ctx.beginPath();
      ctx.moveTo(sm[0][0], sm[0][1]);
      sm.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.strokeStyle = '#F97316';
      ctx.lineWidth   = 3;
      ctx.stroke();

      // Shimmer
      ctx.beginPath();
      ctx.moveTo(sm[0][0], sm[0][1]);
      sm.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.strokeStyle = 'rgba(255,210,160,0.4)';
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.restore();
    }

    function drawTip(x: number, y: number, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#F97316';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
    }

    function drawLabel(text: string, alpha: number) {
      if (alpha <= 0) return;
      const cx = canvas!.width  / 2;
      const cy = canvas!.height - 36;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font        = '600 11px system-ui, sans-serif';
      ctx.fillStyle   = '#6B7280';
      ctx.textAlign   = 'center';
      ctx.letterSpacing = '1px';
      ctx.fillText(text.toUpperCase(), cx, cy);
      ctx.restore();
    }

    function addParticle(x: number, y: number) {
      if (Math.random() > 0.15) return;
      s.particles.push({
        x, y,
        vx:   (Math.random() - 0.5) * 1.4,
        vy:   (Math.random() - 0.5) * 1.4,
        life: 1,
      });
    }

    function updateParticles() {
      s.particles = s.particles.filter(p => {
        p.x    += p.vx;
        p.y    += p.vy;
        p.life -= 0.04;
        return p.life > 0;
      });
    }

    function drawParticles(alpha: number) {
      s.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life * alpha * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + p.life * 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FDBA74';
        ctx.fill();
        ctx.restore();
      });
    }

    function tick() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      drawGrid();

      if (s.phase === 'draw') {
        s.progress = Math.min(s.progress + 2.4, s.allPts.length - 1);
        s.drawnPts = s.allPts.slice(0, Math.ceil(s.progress));

        if (s.drawnPts.length > 1) {
          const tip = s.drawnPts[s.drawnPts.length - 1];
          addParticle(tip[0], tip[1]);
        }

        updateParticles();
        drawParticles(1);
        drawRope(s.drawnPts, 1);

        if (s.drawnPts.length > 1) {
          const tip = s.drawnPts[s.drawnPts.length - 1];
          drawTip(tip[0], tip[1], 1);
        }

        if (s.progress >= s.allPts.length - 1) {
          s.phase = 'hold';
          s.holdTimer = window.setTimeout(() => {
            s.phase = 'fade';
          }, 2600);
        }

      } else if (s.phase === 'hold') {
        s.labelAlpha = Math.min(s.labelAlpha + 0.05, 1);
        updateParticles();
        drawParticles(1);
        drawRope(s.allPts, 1);
        const tip = s.allPts[s.allPts.length - 1];
        drawTip(tip[0], tip[1], 1);
        drawLabel(s.label, s.labelAlpha);

      } else if (s.phase === 'fade') {
        s.alpha      = Math.max(0, s.alpha - 0.018);
        s.labelAlpha = s.alpha;
        updateParticles();
        drawParticles(s.alpha);
        drawRope(s.allPts, s.alpha);
        const tip = s.allPts[s.allPts.length - 1];
        drawTip(tip[0], tip[1], s.alpha);
        drawLabel(s.label, s.labelAlpha);

        if (s.alpha <= 0) {
          s.shapeIdx = (s.shapeIdx + 1) % SHAPES.length;
          window.setTimeout(startShape, 350);
          return;
        }
      }

      s.animId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(s.animId);
      clearTimeout(s.holdTimer);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}