// src/pages/landing/Landing/animations.ts

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { ShoppingBag, Sparkles } from 'lucide-react';
import { ease } from './constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Particle {
  id:       number;
  x:        number;
  y:        number;
  color:    string;
  scale:    number;
  rotation: number;
}

interface FlyingLogoProps {
  startRect:  DOMRect;
  sellRect:   DOMRect;
  anyRect:    DOMRect;
  onComplete: () => void;
  onSellHit:  () => void;
  onAnyHit:   () => void;
  isPaused:   boolean;
}

// ── Particle Explosion ────────────────────────────────────────────────────────

export function ParticleExplosion({ x, y }: { x: number; y: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = ['#f97316', '#fb923c', '#fdba74', '#fcd34d'];
    const next = Array.from({ length: 14 }, (_, i) => ({
      id:       i,
      x:        (Math.random() - 0.5) * 110,
      y:        (Math.random() - 0.5) * 110,
      color:    colors[Math.floor(Math.random() * colors.length)],
      scale:    0.4 + Math.random() * 0.6,
      rotation: Math.random() * 360,
    }));
    setParticles(next);
    const t = setTimeout(() => setParticles([]), 900);
    return () => clearTimeout(t);
  }, [x, y]);

  return (
    <AnimatePresence>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x, y, scale: 0, opacity: 1, rotate: 0 }}
          animate={{ x: x + p.x, y: y + p.y, scale: p.scale, opacity: 0, rotate: p.rotation }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: ease.outExpo }}
          style={{
            position:        'fixed',
            top:             0,
            left:            0,
            width:           7,
            height:          7,
            borderRadius:    '50%',
            backgroundColor: p.color,
            pointerEvents:   'none',
            zIndex:          10000,
          }}
        />
      ))}
    </AnimatePresence>
  );
}

// ── Flying Logo ───────────────────────────────────────────────────────────────

export function FlyingLogo({
  startRect,
  sellRect,
  anyRect,
  onComplete,
  onSellHit,
  onAnyHit,
  isPaused,
}: FlyingLogoProps) {
  const controls                    = useAnimation();
  const [sold, setSold]             = useState(false);
  const [burst, setBurst]           = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible]       = useState(true);

  const W = 40; const H = 40;

  // Clamp position to always stay within viewport
  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  const safeX = (x: number) => clamp(x, 0, window.innerWidth  - W);
  const safeY = (y: number) => clamp(y, 64, window.innerHeight - H);

  const start  = { x: startRect.left, y: startRect.top };
  const onSell = {
    x: safeX(sellRect.left + sellRect.width  / 2 - W / 2),
    y: safeY(sellRect.top  - H - 2),
  };
  const onAny  = {
    x: safeX(anyRect.left  + anyRect.width   / 2 - W / 2),
    y: safeY(anyRect.top   - H - 2),
  };

  // Hide/show when menu opens/closes
  useEffect(() => {
    setVisible(!isPaused);
  }, [isPaused]);

  useEffect(() => {
    // Lock scroll for the duration of the animation
    document.body.style.overflow = 'hidden';

    const run = async () => {
      // 1 — Anticipation shake + wind-up
      await controls.start({
        x:      [start.x, start.x - 10, start.x + 8, start.x - 5, start.x + 3, start.x],
        y:      [start.y, start.y + 4,  start.y - 6, start.y + 2, start.y],
        scaleX: [1, 0.85, 1.1, 0.95, 1],
        scaleY: [1, 1.15, 0.9, 1.05, 1],
        rotate: [0, -12, 10, -5, 0],
        transition: { duration: 0.55, ease: 'easeInOut' },
      });

      await new Promise(r => setTimeout(r, 80));

      // 2 — Stretch toward "Scale"
      await controls.start({
        x: onSell.x, y: onSell.y - 50,
        scaleX: 0.7, scaleY: 1.4, rotate: -160,
        transition: { duration: 0.22, ease: ease.inExpo },
      });

      // 3 — Squash impact on "Scale"
      await controls.start({
        x: onSell.x, y: onSell.y,
        scaleX: 1.45, scaleY: 0.55, rotate: -360,
        transition: { duration: 0.13, ease: ease.inExpo },
      });

      onSellHit();
      setBurst({ x: onSell.x + W / 2, y: onSell.y + H / 2 });

      // 4 — Recover from squash
      await controls.start({
        scaleX: [1.45, 0.88, 1.06, 1],
        scaleY: [0.55, 1.12, 0.94, 1],
        transition: { duration: 0.42, ease: ease.elastic },
      });

      await new Promise(r => setTimeout(r, 100));

      // 5 — Wind up for arc
      await controls.start({
        scaleX: 0.82, scaleY: 1.18, rotate: -20,
        transition: { duration: 0.18, ease: 'easeOut' },
      });

      // 6 — Arc + spin to "smoothly."
      const midX = (onSell.x + onAny.x) / 2;
      const midY = Math.min(onSell.y, onAny.y) - 110;

      await controls.start({
        x:      [onSell.x, midX,   onAny.x],
        y:      [onSell.y, midY,   onAny.y],
        scaleX: [0.82, 0.62, 0.82],
        scaleY: [1.18, 1.48, 1.18],
        rotate: [-20, 180, 540],
        transition: { duration: 0.5, ease: ease.inOut, times: [0, 0.5, 1] },
      });

      // 7 — Heavy impact on "smoothly."
      await controls.start({
        scaleX: 1.5, scaleY: 0.5, rotate: 720,
        transition: { duration: 0.11, ease: ease.inExpo },
      });

      onAnyHit();
      setBurst({ x: onAny.x + W / 2, y: onAny.y + H / 2 });

      // 8 — Double bounce recovery
      await controls.start({
        y:      [onAny.y, onAny.y - 36, onAny.y, onAny.y - 18, onAny.y],
        scaleX: [1.5,  0.88, 1.1,  0.94, 1],
        scaleY: [0.5,  1.12, 0.9,  1.06, 1],
        transition: {
          duration: 0.72,
          ease:     ease.elastic,
          times:    [0, 0.22, 0.45, 0.72, 1],
        },
      });

      await new Promise(r => setTimeout(r, 160));

      // 9 — Morph to SOLD
      await controls.start({
        scaleX: [1, 0, 0, 1.2, 1],
        scaleY: [1, 0, 0, 1.2, 1],
        rotate: [720, 720, 900, 900, 1080],
        transition: { duration: 0.48, ease: 'easeInOut' },
      });
      setSold(true);

      await new Promise(r => setTimeout(r, 380));

      // 10 — Victory bounce
      await controls.start({
        y:      [onAny.y, onAny.y - 28, onAny.y],
        scaleX: [1, 1.2, 1],
        scaleY: [1, 0.8, 1],
        transition: { duration: 0.28, ease: ease.bounce },
      });

      // 11 — Arc home
      controls.start({
        x:      [onAny.x, (onAny.x + start.x) / 2 + 50, start.x],
        y:      [onAny.y, onAny.y - 140,                 start.y],
        scaleX: [1, 0.78, 1],
        scaleY: [1, 1.22, 1],
        rotate: [1080, 990, 900],
        transition: {
          duration: 0.58,
          ease:     ease.outExpo,
          times:    [0, 0.42, 1],
        },
      });

      // Flip back to orange bag halfway through the arc
      await new Promise(r => setTimeout(r, 240));
      setSold(false);
      await new Promise(r => setTimeout(r, 340));

      // 12 — Landing squash
      await controls.start({
        scaleX: [1, 1.3, 0.88, 1.06, 1],
        scaleY: [1, 0.7, 1.12, 0.94, 1],
        transition: { duration: 0.38, ease: ease.elastic },
      });

      // Done — unlock scroll
      document.body.style.overflow = '';
      onComplete();
    };

    run();

    return () => {
      // Safety: always unlock scroll if component unmounts mid-animation
      document.body.style.overflow = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {burst && <ParticleExplosion x={burst.x} y={burst.y} />}
      <motion.div
        animate={controls}
        initial={{ x: start.x, y: start.y, rotate: 0, scaleX: 1, scaleY: 1 }}
        style={{
          position:      'fixed',
          top:           0,
          left:          0,
          width:         W,
          height:        H,
          zIndex:        9999,
          pointerEvents: 'none',
          visibility:    visible ? 'visible' : 'hidden',
        }}
      >
        <motion.div
          style={{
            width:           '100%',
            height:          '100%',
            borderRadius:    8,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            backgroundColor: sold ? '#16a34a' : '#f97316',
            transition:      'background-color 0.15s ease',
            overflow:        'hidden',
          }}
          animate={sold ? {
            boxShadow: [
              '0 0 0px rgba(22,163,74,0)',
              '0 0 24px rgba(22,163,74,0.7)',
              '0 0 0px rgba(22,163,74,0)',
            ],
          } : {}}
          transition={{ duration: 0.7, repeat: 2 }}
        >
          <AnimatePresence mode="wait">
            {!sold ? (
              <motion.div
                key="bag"
                initial={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.2, rotate: 180 }}
                transition={{ duration: 0.13 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ShoppingBag style={{ width: 22, height: 22, color: 'white' }} />
              </motion.div>
            ) : (
              <motion.div
                key="sold"
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: ease.elastic }}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            2,
                }}
              >
                <Sparkles style={{ width: 10, height: 10, color: 'white' }} />
                <span style={{
                  color:       'white',
                  fontWeight:  800,
                  fontSize:    9,
                  letterSpacing: '0.03em',
                  fontFamily:  'system-ui, sans-serif',
                  whiteSpace:  'nowrap',
                }}>
                  SOLD!
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
}

// ── NudgeWord ─────────────────────────────────────────────────────────────────

export function NudgeWord({ children, nudge, className, innerRef }: {
  children:  React.ReactNode;
  nudge:     boolean;
  className?: string;
  innerRef?: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <motion.span
      className={className}
      animate={nudge
        ? { y: [0, 8, -3, 2, 0], scaleY: [1, 0.88, 1.04, 0.97, 1] }
        : { y: 0, scaleY: 1 }
      }
      transition={{ duration: 0.48, ease: ease.elastic }}
      style={{ display: 'inline-block', transformOrigin: 'bottom center' }}
    >
      <span ref={innerRef}>{children}</span>
    </motion.span>
  );
}

// ── FlipText ──────────────────────────────────────────────────────────────────

export function FlipText({
  first,
  second,
  third,
  className,
}: {
  first:     string;
  second:    string;
  third?:    string;
  className?: string;
}) {
  const texts  = [first, second, ...(third ? [third] : [])];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const initial = setTimeout(() => {
      setIdx(1);
      const interval = setInterval(() => {
        setIdx(prev => (prev + 1) % texts.length);
      }, 3000);
      return () => clearInterval(interval);
    }, 2000);
    return () => clearTimeout(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className={className}
      style={{ display: 'inline-block', perspective: 800 }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ rotateX: 90, opacity: 0 }}
          animate={{ rotateX: 0,  opacity: 1 }}
          exit={{   rotateX: -90, opacity: 0 }}
          transition={{ duration: 0.4, ease: ease.outExpo }}
          style={{ display: 'inline-block', transformOrigin: 'center' }}
        >
          {texts[idx]}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}