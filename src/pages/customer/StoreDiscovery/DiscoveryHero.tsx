// src/pages/customer/StoreDiscovery/DiscoveryHero.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ShieldCheck, Package,
  Store, Users, Zap, Star, TrendingUp, Lock, CheckCircle, ArrowRight, Rocket, DollarSign, BarChart3
} from 'lucide-react';

/* ─── TYPES ─── */
interface Props {
  searchQuery: string;
  onSearch: (value: string) => void;
}

type Phase = 'intro' | 'normal' | 'world' | 'listing' | 'escrow' | 'dropshiphero' | 'dropship';

interface ParticleDatum {
  id: number;
  x: number;
  size: number;
  dur: number;
  delay: number;
  opacity: number;
  shape: 'diamond' | 'circle';
}

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  dur: number;
  rotate: number;
}

interface StoreSource {
  name: string;
  emoji: string;
  color: string;
  x: string;
  y: string;
  delay: number;
}

interface CartItem {
  emoji: string;
  color: string;
  price: string;
  fromStore: number;
  delay: number;
}

interface Platform {
  name: string;
  tagline: string;
  color: string;
  glow: string;
  bg: string;
  border: string;
  delay: number;
  products: string[];
  count: number;
}

interface DropshipNode {
  label: string;
  Icon: React.ElementType;
  color: string;
}

interface DropshipProduct {
  name: string;
  markup: string;
  category: string;
  color: string;
}

/* ─── CONSTANTS ─── */
const PHASES: Phase[] = ['intro', 'normal', 'world', 'listing', 'escrow', 'dropshiphero', 'dropship'];
const PHASE_MS: Record<Phase, number> = {
  intro: 4500, normal: 4000, world: 7000,
  listing: 7000, escrow: 6000, dropshiphero: 4500, dropship: 7000,
};

const PARTICLE_DATA: ParticleDatum[] = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  x: (i * 11 + 5) % 100,
  size: 1 + (i % 4) * 0.8,
  dur: 8 + (i % 8),
  delay: (i * 0.28) % 7,
  opacity: 0.04 + (i % 6) * 0.03,
  shape: i % 5 === 0 ? 'diamond' : 'circle',
}));

const CONFETTI_PIECES: ConfettiPiece[] = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  x: 10 + (i * 17 + 3) % 80,
  color: ['#f97316', '#22c55e', '#facc15', '#ec4899', '#60a5fa', '#a78bfa', '#fff'][i % 7],
  size: 4 + (i % 4) * 2,
  delay: (i * 0.06) % 1.2,
  dur: 1.4 + (i % 5) * 0.2,
  rotate: (i * 37) % 360,
}));

const STORE_SOURCES: StoreSource[] = [
  { name: 'Mens World',  emoji: '👔', color: '#60a5fa', x: '8%',  y: '18%', delay: 0.4 },
  { name: 'Her Store',   emoji: '👗', color: '#ec4899', x: '78%', y: '12%', delay: 0.9 },
  { name: 'Tech & More', emoji: '📱', color: '#06b6d4', x: '6%',  y: '60%', delay: 1.4 },
  { name: 'Glow Store',  emoji: '💄', color: '#a78bfa', x: '80%', y: '58%', delay: 1.9 },
  { name: 'Drip',        emoji: '👟', color: '#34d399', x: '50%', y: '8%',  delay: 2.4 },
  { name: 'Food Hub',    emoji: '🍱', color: '#fbbf24', x: '82%', y: '34%', delay: 2.9 },
];

const CART_ITEMS: CartItem[] = [
  { emoji: '👔', color: '#60a5fa', price: '₦12,300', fromStore: 0, delay: 1.2 },
  { emoji: '👗', color: '#ec4899', price: '₦8,500',  fromStore: 1, delay: 1.8 },
  { emoji: '📱', color: '#06b6d4', price: '₦45,000', fromStore: 2, delay: 2.4 },
  { emoji: '💄', color: '#a78bfa', price: '₦3,200',  fromStore: 3, delay: 3.0 },
  { emoji: '👟', color: '#34d399', price: '₦18,000', fromStore: 4, delay: 3.6 },
  { emoji: '🍱', color: '#fbbf24', price: '₦2,800',  fromStore: 5, delay: 4.2 },
];

const PLATFORMS: Platform[] = [
  { name: 'JUMIA', tagline: "Nigeria's #1 marketplace", color: '#fff7ed', glow: 'rgba(255,237,213,0.6)', bg: 'rgba(249,115,22,0.25)', border: 'rgba(255,200,150,0.7)', delay: 0.3, products: ['Shoes', 'Phones', 'Fashion'], count: 298 },
  { name: 'KONGA', tagline: 'Shop smarter, pay better',  color: '#22c55e', glow: 'rgba(34,197,94,0.7)',   bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.6)',  delay: 0.7, products: ['Electronics', 'Home', 'Beauty'], count: 356 },
  { name: 'JIJI',  tagline: 'Buy & sell instantly',      color: '#facc15', glow: 'rgba(250,204,21,0.7)', bg: 'rgba(250,204,21,0.15)', border: 'rgba(250,204,21,0.6)', delay: 1.1, products: ['Cars', 'Property', 'Phones'], count: 214 },
];

const DROPSHIP_NODES: DropshipNode[] = [
  { label: 'Supplier',    Icon: Store,      color: '#f97316' },
  { label: 'QAfrica',     Icon: Zap,        color: '#fbbf24' },
  { label: 'Your Store',  Icon: TrendingUp, color: '#34d399' },
  { label: 'Customer',    Icon: Users,      color: '#60a5fa' },
];

const DROPSHIP_PRODUCTS: DropshipProduct[] = [
  { name: 'Air Fryer',  markup: '₦4,200', category: 'Kitchen', color: '#f97316' },
  { name: 'Lace Wig',   markup: '₦8,500', category: 'Beauty',  color: '#ec4899' },
  { name: 'Power Bank', markup: '₦2,800', category: 'Tech',    color: '#06b6d4' },
  { name: 'Sneakers',   markup: '₦6,100', category: 'Fashion', color: '#8b5cf6' },
];

/* ─── ANIMATION HELPERS ─── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as number[] },
});

const springTransition = (delay = 0, stiffness = 220, damping = 18) => ({
  type: 'spring' as const, stiffness, damping, delay,
});

/* ─── PARTICLES ─── */
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {PARTICLE_DATA.map(p => (
        <motion.div
          key={p.id}
          className="absolute bg-white"
          style={{
            width: p.size, height: p.size,
            left: `${p.x}%`, bottom: -8,
            opacity: p.opacity,
            borderRadius: p.shape === 'diamond' ? '2px' : '50%',
            rotate: p.shape === 'diamond' ? 45 : 0,
          }}
          animate={{ y: [0, -520], opacity: [p.opacity, p.opacity * 1.5, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

/* ─── CONFETTI ─── */
function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {CONFETTI_PIECES.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{ width: p.size, height: p.size * 0.5, left: `${p.x}%`, top: -12, background: p.color, rotate: p.rotate }}
          initial={{ y: -20, opacity: 1, rotate: p.rotate }}
          animate={{ y: 500, opacity: [1, 1, 0], rotate: p.rotate + 720 }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

/* ─── TYPEWRITER ─── */
function Typewriter({ text, delay = 0, className = '' }: { text: string; delay?: number; className?: string }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted]     = useState(false);

  useEffect(() => {
    setDisplayed('');
    setStarted(false);
    const t = setTimeout(() => setStarted(true), delay * 1000);
    return () => clearTimeout(t);
  }, [text, delay]);

  useEffect(() => {
    if (!started || displayed.length >= text.length) return;
    const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), 48);
    return () => clearTimeout(t);
  }, [started, displayed, text]);

  return (
    <span className={className}>
      {displayed}
      {started && displayed.length < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className="inline-block w-0.5 h-5 bg-current align-middle ml-0.5"
        />
      )}
    </span>
  );
}

/* ─── SVGs ─── */
function CartSVG() {
  return (
    <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M10 18 L18 18 L28 62 L96 62 L108 28 L24 28" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="28" y1="62" x2="96" y2="62" stroke="white" strokeWidth="5.5" strokeLinecap="round"/>
      <circle cx="42" cy="74" r="7" fill="white" />
      <circle cx="82" cy="74" r="7" fill="white" />
      <circle cx="42" cy="74" r="3.5" fill="rgba(249,115,22,0.8)" />
      <circle cx="82" cy="74" r="3.5" fill="rgba(249,115,22,0.8)" />
      <line x1="10" y1="18" x2="2" y2="18" stroke="white" strokeWidth="5.5" strokeLinecap="round"/>
    </svg>
  );
}

function FingerSVG() {
  return (
    <svg viewBox="0 0 60 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="14" y="42" width="34" height="36" rx="10" fill="#FDDCB5" stroke="#e8b88a" strokeWidth="1.5"/>
      <rect x="22" y="10" width="14" height="36" rx="7"   fill="#FDDCB5" stroke="#e8b88a" strokeWidth="1.5"/>
      <rect x="37" y="22" width="11" height="26" rx="5.5" fill="#FDDCB5" stroke="#e8b88a" strokeWidth="1.5"/>
      <rect x="10" y="26" width="11" height="22" rx="5.5" fill="#FDDCB5" stroke="#e8b88a" strokeWidth="1.5"/>
      <rect x="2"  y="42" width="12" height="18" rx="6"   fill="#FDDCB5" stroke="#e8b88a" strokeWidth="1.5"/>
      <rect x="25" y="13" width="8"  height="9"  rx="4"   fill="#f9a8d4" opacity="0.6"/>
    </svg>
  );
}

/* ─── FLYING ITEM ─── */
function FlyingItem({ item }: { item: CartItem }) {
  const store = STORE_SOURCES[item.fromStore];
  const targetX = `calc(28vw - ${store.x})`;
  const targetY = `calc(45% - ${store.y})`;

  return (
    <motion.div
      className="absolute pointer-events-none z-20"
      style={{ left: store.x, top: store.y, transform: 'translate(-50%, -50%)' }}
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.1, 1, 0.3], x: [0, targetX], y: [0, targetY] }}
      transition={{ duration: 1.6, delay: item.delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-2xl drop-shadow-lg">{item.emoji}</div>
        <div className="bg-white rounded-lg px-1.5 py-0.5 shadow-lg">
          <div className="font-black text-[8px]" style={{ color: item.color }}>{item.price}</div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── AFRICA BAG SVG ─── */
function AfricaBagSVG() {
  return (
    <svg viewBox="0 0 160 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="16" y="60" width="128" height="108" rx="20" fill="white" fillOpacity="0.22" stroke="white" strokeWidth="4"/>
      <path d="M56 60 C56 28 72 14 80 14 C88 14 104 28 104 60" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
      <line x1="16" y1="90" x2="144" y2="90" stroke="white" strokeWidth="1.5" strokeOpacity="0.2"/>
      <path d="M30 72 L44 68 L46 82 L32 86 Z" fill="white" fillOpacity="0.15"/>
    </svg>
  );
}

/* ─── PHASE: INTRO ─── */
function PhaseIntro() {
  return (
    <motion.div
      key="intro"
      className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06, filter: 'blur(4px)' }}
      transition={{ duration: 0.7 }}
    >
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{ width: 280, height: 280, background: 'rgba(255,255,255,0.18)' }}
        animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.5, 0.8, 0.5] }}
        transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
      />
      <motion.div
        style={{ width: 175, height: 220 }}
        initial={{ scale: 0, rotate: -12, y: 30 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }}
      >
        <motion.div
          style={{ width: '100%', height: '100%' }}
          animate={{ y: [0, -18, 0, -10, 0], rotate: [0, 3, 0, -2, 0], scale: [1, 1.04, 1, 1.02, 1] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        >
          <AfricaBagSVG />
        </motion.div>
      </motion.div>

      <motion.div
        className="rounded-full blur-md"
        style={{ width: 90, height: 14, background: 'rgba(0,0,0,0.25)', marginTop: -6 }}
        animate={{ scaleX: [1, 0.6, 1, 0.75, 1], opacity: [0.5, 0.25, 0.5, 0.3, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
      />

      <motion.div
        className="text-center mt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-white font-black text-4xl sm:text-5xl leading-tight tracking-tight mb-2">
          QAfrica
        </h1>
        <p className="text-white/75 text-base sm:text-lg font-medium">
          Africa's marketplace, in your pocket.
        </p>
      </motion.div>

      {[0, 1, 2, 3, 4, 5].map(i => {
        const angle = (i / 6) * Math.PI * 2;
        const r = 115;
        const cx = 50 + Math.cos(angle) * r * 0.38;
        const cy = 40 + Math.sin(angle) * r * 0.28;
        return (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-white rounded-full"
            style={{ left: `${cx}%`, top: `${cy}%` }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0.8, 0], scale: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, delay: i * 0.36, ease: 'easeInOut' }}
          />
        );
      })}
    </motion.div>
  );
}

/* ─── PHASE: NORMAL ─── */
function PhaseNormal() {
  return (
    <motion.div
      key="normal"
      className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(3px)' }}
      transition={{ duration: 0.6 }}
    >
      <motion.div {...fadeUp()} className="text-center">
        <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-4 py-1.5 mb-5">
          <motion.div
            animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="w-2 h-2 bg-green-300 rounded-full"
          />
          <span className="text-white/90 text-xs font-semibold tracking-wider uppercase">Live Marketplace</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4">
          Discover<br /><span className="text-orange-200">Amazing Stores</span>
        </h1>
        <p className="text-orange-100/80 text-base sm:text-lg max-w-sm mx-auto leading-relaxed mb-6">
          Browse verified sellers across Nigeria. Find everything in one place.
        </p>
        <div className="flex gap-2 justify-center mt-2">
          {['M', 'H', 'T', 'G', 'D'].map((l, i) => (
            <motion.div
              key={l}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springTransition(0.4 + i * 0.1, 220)}
              className="w-10 h-10 bg-white/20 border border-white/25 rounded-xl flex items-center justify-center"
            >
              <span className="text-white font-black text-sm">{l}</span>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}
            className="w-10 h-10 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center"
          >
            <span className="text-white/60 text-xs font-bold">+</span>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── PHASE: WORLD ─── */
const CART_KEYFRAMES = {
  x:       [-160, '10vw', '28vw', '55vw', '110vw'],
  opacity: [0, 1, 1, 1, 0],
};
const FINGER_KEYFRAMES = {
  x:       [-80, '8vw', '26vw', '52vw', '108vw'],
  opacity: [0, 1, 1, 1, 0],
  y:       [0, 0, -6, 0, 0],
};
const SWEEP_TRANSITION = { duration: 6.5, ease: [0.3, 0, 0.4, 1] as number[], times: [0, 0.08, 0.4, 0.85, 1] };

function PhaseWorld() {
  return (
    <motion.div
      key="world"
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(6px)' }}
      transition={{ duration: 0.6 }}
    >
      <div className="absolute inset-0 bg-black/10" />
      <motion.div className="absolute top-6 left-0 right-0 text-center z-40 px-4" {...fadeUp(0.2)}>
        <h2
          className="text-white font-black text-2xl sm:text-3xl leading-tight"
          style={{ textShadow: '0 2px 24px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.4)' }}
        >
          Shop from <span className="text-orange-200">every store</span><br />in one place
        </h2>
      </motion.div>

      {STORE_SOURCES.map(s => (
        <motion.div
          key={s.name}
          className="absolute flex flex-col items-center gap-0.5 z-10"
          style={{ left: s.x, top: s.y, transform: 'translate(-50%, -50%)' }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springTransition(s.delay - 0.2, 220, 18)}
        >
          <motion.div
            className="w-11 h-11 bg-white rounded-2xl shadow-xl flex items-center justify-center text-xl"
            animate={{ boxShadow: [`0 0 0 0 ${s.color}00`, `0 0 0 8px ${s.color}40`, `0 0 0 0 ${s.color}00`] }}
            transition={{ repeat: Infinity, duration: 2.4, delay: s.delay }}
          >
            {s.emoji}
          </motion.div>
          <span className="text-white/70 text-[7px] font-bold whitespace-nowrap bg-black/20 rounded px-1">{s.name}</span>
        </motion.div>
      ))}

      {CART_ITEMS.map((item, i) => (
        <FlyingItem key={i} item={item} />
      ))}

      <motion.div
        className="absolute z-10"
        style={{ top: '38%', width: 130, height: 108 }}
        animate={CART_KEYFRAMES}
        transition={{ ...SWEEP_TRANSITION, delay: 0.5 }}
      >
        <motion.div
          className="absolute -inset-4 rounded-full blur-2xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          style={{ background: 'rgba(255,255,255,0.25)' }}
        />
        <CartSVG />
        <div className="absolute top-5 left-8 flex flex-wrap gap-0.5 w-16 overflow-hidden">
          {CART_ITEMS.map((item, i) => (
            <motion.span
              key={i}
              className="text-sm"
              initial={{ opacity: 0, y: -8, scale: 0 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: item.delay + 1.0, ...springTransition(0, 300) }}
            >
              {item.emoji}
            </motion.span>
          ))}
        </div>
        <motion.div
          className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg"
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={springTransition(1.8)}
        >
          <motion.span
            className="text-orange-500 font-black text-sm"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 2 }}
          >
            6
          </motion.span>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute z-30"
        style={{ top: '64%', width: 44, height: 66 }}
        animate={FINGER_KEYFRAMES}
        transition={{ ...SWEEP_TRANSITION, delay: 0.7 }}
      >
        <FingerSVG />
        <motion.div
          className="absolute -inset-2 rounded-full border-2 border-white/50"
          initial={{ scale: 0.5, opacity: 0.8 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 1.4, delay: 1.2 }}
        />
      </motion.div>

      <motion.div className="absolute bottom-16 left-0 right-0 text-center px-4 z-30" {...fadeUp(2.5)}>
        <div className="inline-block bg-black/25 backdrop-blur rounded-2xl px-5 py-2.5">
          <p className="text-white font-black text-base sm:text-lg">One cart · Every store · All Nigeria</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── PLATFORM CARD ─── */
function PlatformCard({ p }: { p: Platform }) {
  const [listed, setListed] = useState(false);
  const [count, setCount]   = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setListed(true);
      let n = 0;
      const iv = setInterval(() => {
        n += Math.floor(Math.random() * 30) + 8;
        if (n >= p.count) {
          setCount(p.count);
          clearInterval(iv);
        } else {
          setCount(n);
        }
      }, 55);
    }, p.delay * 1000 + 700);
    return () => clearTimeout(t);
  }, [p.count, p.delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 36, scale: 0.82 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springTransition(p.delay, 180, 20)}
      className="relative flex-1 min-w-0 rounded-2xl overflow-hidden"
      style={{ background: p.bg, border: `1.5px solid ${p.border}` }}
    >
      <motion.div
        className="absolute inset-0 rounded-2xl"
        animate={{ opacity: [0.1, 0.4, 0.1] }}
        transition={{ repeat: Infinity, duration: 2.5, delay: p.delay }}
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${p.glow} 0%, transparent 70%)` }}
      />
      <div className="relative p-3 flex flex-col items-center gap-1.5">
        <motion.div
          animate={{ textShadow: [`0 0 14px ${p.glow}`, `0 0 26px ${p.glow}`, `0 0 14px ${p.glow}`] }}
          transition={{ repeat: Infinity, duration: 2.4, delay: p.delay }}
          style={{ color: p.color }}
          className="font-black text-2xl sm:text-3xl tracking-tight leading-none"
        >
          {p.name}
        </motion.div>
        <span className="text-white/50 text-[8px] font-medium text-center leading-tight">{p.tagline}</span>

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={listed ? { scale: 1, opacity: 1 } : {}}
          transition={springTransition(0, 300, 14)}
          className="flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{ background: p.color + '22', border: `1px solid ${p.color}55` }}
        >
          <motion.div
            animate={{ scale: [1, 1.6, 1] }}
            transition={{ repeat: Infinity, duration: 1.3 }}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-white font-bold text-[8px]">LIVE</span>
        </motion.div>

        <div className="text-center">
          <div className="font-black text-lg text-white leading-none">{count}</div>
          <div className="text-white/40 text-[7px]">products listed</div>
        </div>

        <div className="flex flex-wrap gap-1 justify-center">
          {p.products.map((prod, i) => (
            <motion.span
              key={prod}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springTransition(p.delay + 1.0 + i * 0.14)}
              className="text-[7px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: p.color + '22', color: p.color, border: `1px solid ${p.color}33` }}
            >
              {prod}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── PHASE: LISTING ─── */
function PhaseListing() {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowConfetti(true), 1400);
    const t2 = setTimeout(() => setShowConfetti(false), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      key="listing"
      className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-20"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
      transition={{ duration: 0.6 }}
    >
      <Confetti show={showConfetti} />
      <div className="absolute inset-0 bg-black/22" />
      <div className="relative z-10 w-full max-w-sm">
        <motion.div className="text-center mb-4" {...fadeUp(0.15)}>
          <motion.div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-3"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <Zap className="w-3 h-3 text-yellow-300" />
            <span className="text-white/90 text-[10px] font-bold tracking-widest uppercase">Auto-List Everywhere</span>
          </motion.div>
          <h2 className="text-white font-black text-2xl sm:text-3xl leading-tight">
            One Upload.<br />
            <Typewriter text="Listed Everywhere." delay={0.6} className="text-orange-200" />
          </h2>
        </motion.div>

        <div className="flex gap-2 mb-4">
          {PLATFORMS.map(p => <PlatformCard key={p.name} p={p} />)}
        </div>

        <motion.div className="flex items-center justify-center gap-2 mb-3" {...fadeUp(1.6)}>
          <div className="flex items-center gap-1.5">
            <motion.div
              className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-xl"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
            >
              <span className="text-orange-500 font-black text-sm">Q</span>
            </motion.div>
            <motion.div
              animate={{ x: [0, 5, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
            >
              <ArrowRight className="w-4 h-4 text-white/60" />
            </motion.div>
            {PLATFORMS.map((p, i) => (
              <motion.span
                key={p.name}
                className="font-black text-sm"
                style={{ color: p.color }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ repeat: Infinity, duration: 2.0, delay: i * 0.35 }}
              >
                {p.name}{i < 2 ? ' +' : ''}
              </motion.span>
            ))}
          </div>
        </motion.div>

        <motion.div className="text-center" {...fadeUp(2.0)}>
          <div className="inline-block bg-black/25 backdrop-blur rounded-2xl px-5 py-2.5">
            <p className="text-white font-black text-base">
              <motion.span
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="text-green-300"
              >
                3× more visibility
              </motion.span>{' '}for your products
            </p>
            <p className="text-white/50 text-[10px]">Without managing 3 separate stores</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─── PHASE: ESCROW ─── */
function PhaseEscrow() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep(p => Math.min(p + 1, 3)), 1100);
    return () => clearInterval(t);
  }, []);

  const steps = [
    { icon: '₦', label: 'Customer Pays',   color: '#fbbf24' },
    { icon: '🔒', label: 'Funds Held Safe', color: '#34d399' },
    { icon: '📦', label: 'Order Delivered', color: '#60a5fa' },
    { icon: '✓',  label: 'Seller Paid',    color: '#a78bfa' },
  ];

  return (
    <motion.div
      key="escrow"
      className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-20"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.6 }}
    >
      {[0, 1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-white/10"
          initial={{ width: 80, height: 80, opacity: 0.7 }}
          animate={{ width: 600, height: 600, opacity: 0 }}
          transition={{ duration: 4.0, delay: i * 0.85, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}

      <motion.div
        className="relative mb-5"
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={springTransition(0, 140, 16)}
      >
        <motion.div
          className="absolute inset-0 blur-3xl rounded-full scale-150"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          style={{ background: 'rgba(52,211,153,0.4)' }}
        />
        <div className="relative w-20 h-20 flex items-center justify-center">
          <ShieldCheck className="w-20 h-20 text-white" strokeWidth={1} />
          <motion.div
            className="absolute text-2xl"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={springTransition(0.5, 280)}
          >
            ✓
          </motion.div>
        </div>
      </motion.div>

      <motion.h2 {...fadeUp(0.4)} className="text-white font-black text-2xl sm:text-3xl text-center mb-1">
        Your Money is Always Safe
      </motion.h2>
      <motion.p {...fadeUp(0.6)} className="text-orange-100/70 text-sm text-center mb-6">
        No fraud. No theft. Guaranteed by QAfrica Escrow™
      </motion.p>

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <motion.div
              className="flex flex-col items-center gap-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springTransition(0.7 + i * 0.18)}
            >
              <motion.div
                className="w-10 h-10 rounded-2xl border-2 flex items-center justify-center text-sm"
                animate={{
                  backgroundColor: step >= i ? s.color + '30' : 'rgba(255,255,255,0.08)',
                  borderColor:     step >= i ? s.color : 'rgba(255,255,255,0.15)',
                  scale:           step === i ? 1.18 : 1,
                }}
                transition={{ duration: 0.45 }}
              >
                <span>{s.icon}</span>
              </motion.div>
              <span className="text-white/50 text-[8px] text-center leading-tight w-12">{s.label}</span>
            </motion.div>
            {i < 3 && (
              <motion.div
                className="w-4 h-px mb-4"
                animate={{ backgroundColor: step > i ? '#fff' : 'rgba(255,255,255,0.2)' }}
                transition={{ duration: 0.45 }}
              />
            )}
          </div>
        ))}
      </div>

      <motion.div
        {...fadeUp(1.4)}
        className="mt-5 bg-white/10 border border-white/20 rounded-2xl px-5 py-3 backdrop-blur flex items-center gap-3"
      >
        <Lock className="w-4 h-4 text-green-300" />
        <div>
          <div className="text-white font-black text-sm">₦45,000 protected</div>
          <div className="text-white/50 text-[10px]">Released after delivery confirmation</div>
        </div>
        <CheckCircle className="w-4 h-4 text-green-300 ml-1" />
      </motion.div>
    </motion.div>
  );
}

/* ─── PHASE: DROPSHIP HERO ─── */
function PhaseDropshipHero() {
  return (
    <motion.div
      key="dropshiphero"
      className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-20"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(6px)' }}
      transition={{ duration: 0.6 }}
    >
      <div className="absolute inset-0 bg-black/38" />
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-white/10"
          initial={{ width: 100, height: 100, opacity: 0 }}
          animate={{ width: 600, height: 600, opacity: [0, 0.4, 0] }}
          transition={{ duration: 4, delay: i * 1.1, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}

      <div className="relative z-10 text-center">
        <motion.div
          className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6"
          style={{ background: 'rgba(249,115,22,0.25)', border: '2px solid rgba(249,115,22,0.6)' }}
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={springTransition(0.1, 160, 14)}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            <Rocket className="w-10 h-10 text-orange-300" />
          </motion.div>
        </motion.div>

        <motion.div {...fadeUp(0.3)} className="mb-2">
          <span className="font-black uppercase tracking-widest text-white/55 text-[12px]">Built specifically for</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={springTransition(0.5, 140, 14)}
          className="font-black leading-none mb-4"
          style={{ fontSize: 'clamp(44px, 13vw, 76px)' }}
        >
          <motion.span
            animate={{ textShadow: ['0 0 20px rgba(249,115,22,0.6)', '0 0 40px rgba(249,115,22,0.9)', '0 0 20px rgba(249,115,22,0.6)'] }}
            transition={{ repeat: Infinity, duration: 2.4 }}
            style={{ color: '#fdba74' }}
          >
            DROP
          </motion.span>
          <br />
          <motion.span
            animate={{ textShadow: ['0 0 20px rgba(255,255,255,0.4)', '0 0 40px rgba(255,255,255,0.7)', '0 0 20px rgba(255,255,255,0.4)'] }}
            transition={{ repeat: Infinity, duration: 2.4, delay: 0.4 }}
            className="text-white"
          >
            SHIPPERS
          </motion.span>
        </motion.h1>

        <motion.p {...fadeUp(0.9)} className="text-orange-100/75 text-base sm:text-lg max-w-xs mx-auto leading-relaxed">
          No warehouse. No stock. No risk.<br />
          <span className="text-white font-bold">Just profit.</span>
        </motion.p>

        <motion.div className="flex gap-3 justify-center mt-6" {...fadeUp(1.3)}>
          {[
            { icon: <DollarSign className="w-3.5 h-3.5" />, label: 'Zero upfront cost' },
            { icon: <BarChart3  className="w-3.5 h-3.5" />, label: 'Set your markup' },
            { icon: <Package   className="w-3.5 h-3.5" />, label: 'We fulfil orders' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springTransition(1.5 + i * 0.14)}
            >
              <span className="text-orange-300">{item.icon}</span>
              <span className="text-white/80 text-[10px] font-semibold whitespace-nowrap">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─── PHASE: DROPSHIP ─── */
function PhaseDropship() {
  const [active, setActive]               = useState(0);
  const [earningsTotal, setEarningsTotal] = useState(0);
  const [floatingIdx, setFloatingIdx]     = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % 4), 1100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setEarningsTotal(p => p + Math.floor(Math.random() * 700) + 300);
      setFloatingIdx(p => (p + 1) % DROPSHIP_PRODUCTS.length);
    }, 1800);
    return () => clearInterval(t);
  }, []);

  const prod = DROPSHIP_PRODUCTS[floatingIdx];

  return (
    <motion.div
      key="dropship"
      className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-20"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(6px)' }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.05, 0.13, 0.05] }}
        transition={{ repeat: Infinity, duration: 3.5 }}
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 70%)' }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={floatingIdx}
          className="absolute top-8 right-4 sm:right-8 z-20"
          initial={{ opacity: 0, x: 44, scale: 0.82 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -24, scale: 0.9 }}
          transition={springTransition(0, 240, 20)}
        >
          <div className="bg-white/15 backdrop-blur border border-white/25 rounded-2xl px-3 py-2 flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: prod.color }}
              animate={{ scale: [1, 1.6, 1] }}
              transition={{ repeat: Infinity, duration: 1.1 }}
            />
            <div>
              <div className="text-white font-black text-xs">{prod.name} sold!</div>
              <div className="font-bold text-[9px]" style={{ color: prod.color }}>+{prod.markup} profit</div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <motion.h2 {...fadeUp()} className="text-white font-black text-2xl sm:text-3xl text-center mb-1 relative z-10">
        Sell Without Holding Stock
      </motion.h2>
      <motion.p {...fadeUp(0.3)} className="text-orange-100/70 text-sm text-center mb-5 relative z-10">
        Import any product. Set your markup. We handle everything else.
      </motion.p>

      <div className="flex items-center gap-2 sm:gap-4 relative z-10">
        {DROPSHIP_NODES.map((n, i) => {
          const { Icon } = n;
          const isActive = active === i;
          return (
            <div key={n.label} className="flex items-center gap-2 sm:gap-3">
              <motion.div
                className="flex flex-col items-center gap-1.5"
                animate={{ scale: isActive ? 1.18 : 1 }}
                transition={{ duration: 0.35 }}
              >
                <motion.div
                  className="w-12 h-12 rounded-2xl border-2 flex items-center justify-center backdrop-blur"
                  animate={{
                    backgroundColor: isActive ? n.color + '25' : 'rgba(255,255,255,0.08)',
                    borderColor:     isActive ? n.color : 'rgba(255,255,255,0.15)',
                    boxShadow:       isActive ? `0 0 26px ${n.color}70` : 'none',
                  }}
                  transition={{ duration: 0.35 }}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </motion.div>
                <span className="text-white/55 text-[9px] font-medium text-center leading-tight w-14">{n.label}</span>
              </motion.div>
              {i < 3 && (
                <div className="relative flex items-center mb-4">
                  <div className="w-6 sm:w-10 h-px bg-white/15" />
                  {isActive && (
                    <motion.div
                      className="absolute -left-1 w-5 h-5 bg-white rounded-lg shadow-lg flex items-center justify-center"
                      initial={{ x: 0, opacity: 0, scale: 0.5 }}
                      animate={{ x: [0, 36, 36], opacity: [0, 1, 0], scale: [0.5, 1, 0.8] }}
                      transition={{ duration: 1.0, ease: 'easeInOut' }}
                    >
                      <Package className="w-2.5 h-2.5 text-orange-500" />
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <motion.div {...fadeUp(0.7)} className="flex flex-wrap gap-2 justify-center mt-4 relative z-10">
        {DROPSHIP_PRODUCTS.map((p, i) => (
          <motion.span
            key={p.name}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springTransition(0.8 + i * 0.12)}
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: floatingIdx === i ? p.color + '30' : 'rgba(255,255,255,0.08)',
              border:     `1px solid ${floatingIdx === i ? p.color : 'rgba(255,255,255,0.15)'}`,
              color:      floatingIdx === i ? p.color : 'rgba(255,255,255,0.7)',
            }}
          >
            {p.category}
          </motion.span>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springTransition(1.1, 160)}
        className="mt-4 bg-white/12 border border-white/20 rounded-2xl px-5 py-3 flex items-center gap-3 backdrop-blur relative z-10"
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          className="w-9 h-9 bg-green-400/25 rounded-xl flex items-center justify-center"
        >
          <span className="text-green-300 font-black">₦</span>
        </motion.div>
        <div>
          <div className="text-white font-black text-base leading-none">
            +₦{earningsTotal.toLocaleString()} today
          </div>
          <div className="text-white/45 text-[10px] mt-0.5">Your total markup earnings</div>
        </div>
        <motion.div animate={{ rotate: [0, 20, -20, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}>
          <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function DiscoveryHero({ searchQuery, onSearch }: Props) {
  const [phase, setPhase]   = useState<Phase>('intro');
  const timerRef            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef            = useRef<Phase>('intro');

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const current   = phaseRef.current;
    const nextIndex = (PHASES.indexOf(current) + 1) % PHASES.length;
    const next      = PHASES[nextIndex];

    timerRef.current = setTimeout(() => {
      phaseRef.current = next;
      setPhase(next);
      scheduleNext();
    }, PHASE_MS[current]);
  }, []);

  useEffect(() => {
    scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scheduleNext]);

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea6510 50%, #dc5a0a 100%)' }}
    >
      <Particles />
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.15) 100%)' }}
      />

      <div className="relative z-10" style={{ height: 440 }}>
        <AnimatePresence mode="wait">
          {phase === 'intro'        && <PhaseIntro        key="intro" />}
          {phase === 'normal'       && <PhaseNormal       key="normal" />}
          {phase === 'world'        && <PhaseWorld        key="world" />}
          {phase === 'listing'      && <PhaseListing      key="listing" />}
          {phase === 'escrow'       && <PhaseEscrow       key="escrow" />}
          {phase === 'dropshiphero' && <PhaseDropshipHero key="dropshiphero" />}
          {phase === 'dropship'     && <PhaseDropship     key="dropship" />}
        </AnimatePresence>
      </div>

      {/* Search bar */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 pb-8">
        <motion.div className="relative" {...fadeUp(0.4)}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search stores, products, niches…"
            className="w-full pl-12 pr-4 py-4 rounded-2xl text-gray-900 bg-white shadow-xl placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-white/25 text-sm"
          />
        </motion.div>
      </div>
    </div>
  );
}
