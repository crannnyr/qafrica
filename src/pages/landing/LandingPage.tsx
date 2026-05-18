import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Store, TrendingUp, Shield, Zap, Globe,
  ChevronRight, Star, Users, Package, CheckCircle,
  Menu, X, ArrowRight, Lock, Truck, Headphones, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DarkModeToggle from '@/components/DarkModeToggle';
import SEO, { OrganizationSchema } from '@/components/SEO';
import CONFIG from '@/lib/config';

// ─── Data ──────────────────────────────────────────────────────────────────────

const features = [
  { icon: Store,      title: 'Beautiful Store Themes',    description: 'Choose from professionally designed themes tailored for your niche. Fully customizable to match your brand.' },
  { icon: Package,    title: 'Product Import Catalog',    description: 'Import products from our curated catalog and expand your inventory instantly — no sourcing needed.' },
  { icon: TrendingUp, title: 'Powerful Analytics',        description: 'Track sales, monitor traffic, and understand your customers with real-time data and visual reports.' },
  { icon: Shield,     title: 'Secure Escrow Payments',    description: '7-day escrow protection ensures safe transactions. Sellers get paid, buyers get what they ordered.' },
  { icon: Zap,        title: 'Lightning Fast Setup',      description: 'Go from zero to a live store in under 10 minutes. No coding, no design skills needed.' },
  { icon: Globe,      title: 'Built for Nigeria',         description: 'Naira pricing, local delivery integrations, and Nigerian payment methods — all out of the box.' },
  { icon: Truck,      title: 'Delivery Zone Management',  description: 'Set custom delivery zones and pricing per region. Serve your city or the whole country.' },
  { icon: Lock,       title: 'Custom Domain Support',     description: 'Connect your own domain and make your store truly yours with a professional web address.' },
  { icon: Headphones, title: 'Dedicated Support',         description: "Our team is based in Nigeria and understands local business challenges. We've got your back." },
];

const niches = CONFIG.NICHES.slice(0, 8);

const testimonials = [
  { name: 'Chioma Adeyemi',  role: 'Fashion Store Owner, Lagos',  content: 'QAFRICA turned my boutique into a full online business. The import catalog alone saves me hours every week.',               rating: 5 },
  { name: 'Emmanuel Okafor', role: 'Electronics Seller, Abuja',   content: 'The analytics dashboard showed me exactly which products were selling and when. My revenue tripled in 3 months.',          rating: 5 },
  { name: 'Amina Ibrahim',   role: 'Jewelry Designer, Kano',      content: 'The escrow system gives my customers confidence to buy. Returns and disputes are handled fairly and quickly.',             rating: 5 },
];

const stats = [
  { value: '10,000+', label: 'Active Stores' },
  { value: '₦500M+',  label: 'Transactions Processed' },
  { value: '50,000+', label: 'Products Listed' },
  { value: '99.9%',   label: 'Uptime' },
];

const pricingTiers = [
  {
    name: 'Starter', price: '5,000', period: '/month', description: 'Perfect for new sellers', popular: false, cta: 'Start Free Trial',
    features: ['1 Niche Selection','Unlimited Products','Basic Analytics','Standard Themes','Email Support','Escrow Payments'],
  },
  {
    name: 'Growth', price: '10,000', period: '/month', description: 'For expanding businesses', popular: true, cta: 'Start Free Trial',
    features: ['3 Niche Selections','Unlimited Products','Advanced Analytics','Premium Themes','Priority Support','Import Catalog Access','Custom Domain'],
  },
  {
    name: 'Enterprise', price: '100,000', period: '/month', description: 'For established brands', popular: false, cta: 'Contact Sales',
    features: ['Unlimited Niches','Unlimited Products','Full Analytics Suite','All Themes + Custom','24/7 Priority Support','Import Catalog + Dropship','Dedicated Account Manager','White-label Options'],
  },
];

const faqs = [
  { q: 'Do I need technical skills to use QAFRICA?',           a: 'None at all. QAFRICA is built for entrepreneurs, not developers. Our store builder is fully drag-and-drop and you can go live in minutes.' },
  { q: 'How does the escrow payment system work?',             a: 'When a customer places an order, payment is held securely for 7 days. Once the customer confirms delivery, funds are released to your wallet. This protects both buyers and sellers.' },
  { q: 'Can I use my own domain name?',                        a: 'Yes. On Growth and Enterprise plans, you can connect a custom domain (e.g. yourstore.com) to make your store fully branded.' },
  { q: 'What payment methods do Nigerian customers support?',  a: 'We support all major Nigerian payment methods including bank transfer, Paystack, and card payments — fully integrated.' },
  { q: 'Is there a free trial?',                               a: "Yes. You can start a free trial on any plan with no credit card required. You only pay when you're ready to go live." },
];

// ─── Easing ────────────────────────────────────────────────────────────────────

const ease = {
  outExpo: [0.16, 1, 0.3, 1]       as const,
  inExpo:  [0.7,  0, 0.84, 0]      as const,
  inOut:   [0.45, 0, 0.55, 1]      as const,
  bounce:  [0.34, 1.6, 0.64, 1]    as const,
  elastic: [0.68, -0.55, 0.265, 1.55] as const,
};

// ─── Particle Explosion ────────────────────────────────────────────────────────

interface Particle { id: number; x: number; y: number; color: string; scale: number; rotation: number }

function ParticleExplosion({ x, y }: { x: number; y: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = ['#f97316', '#fb923c', '#fdba74', '#fcd34d'];
    const next = Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 110,
      y: (Math.random() - 0.5) * 110,
      color: colors[Math.floor(Math.random() * colors.length)],
      scale: 0.4 + Math.random() * 0.6,
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
            position: 'fixed', top: 0, left: 0,
            width: 7, height: 7, borderRadius: '50%',
            backgroundColor: p.color, pointerEvents: 'none', zIndex: 10000,
          }}
        />
      ))}
    </AnimatePresence>
  );
}

// ─── Flying Logo ───────────────────────────────────────────────────────────────

interface FlyingLogoProps {
  startRect: DOMRect; sellRect: DOMRect; anyRect: DOMRect;
  onComplete: () => void; onSellHit: () => void; onAnyHit: () => void;
}

function FlyingLogo({ startRect, sellRect, anyRect, onComplete, onSellHit, onAnyHit }: FlyingLogoProps) {
  const controls = useAnimation();
  const [sold, setSold] = useState(false);
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null);

  const W = 40; const H = 40;

  const start  = { x: startRect.left, y: startRect.top };
  const onSell = { x: sellRect.left + sellRect.width  / 2 - W / 2, y: sellRect.top - H - 2 };
  const onAny  = { x: anyRect.left  + anyRect.width   / 2 - W / 2, y: anyRect.top  - H - 2 };

  useEffect(() => {
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

      // 2 — Stretch toward "Sell"
      await controls.start({
        x: onSell.x, y: onSell.y - 50,
        scaleX: 0.7, scaleY: 1.4, rotate: -160,
        transition: { duration: 0.22, ease: ease.inExpo },
      });

      // 3 — Squash impact on "Sell"
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

      // 6 — Arc + spin to "anything."
      const midX = (onSell.x + onAny.x) / 2;
      const midY = Math.min(onSell.y, onAny.y) - 110;

      await controls.start({
        x:      [onSell.x, midX,  onAny.x],
        y:      [onSell.y, midY,  onAny.y],
        scaleX: [0.82, 0.62, 0.82],
        scaleY: [1.18, 1.48, 1.18],
        rotate: [-20, 180, 540],
        transition: { duration: 0.5, ease: ease.inOut, times: [0, 0.5, 1] },
      });

      // 7 — Heavy impact on "anything."
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
        transition: { duration: 0.72, ease: ease.elastic, times: [0, 0.22, 0.45, 0.72, 1] },
      });

      await new Promise(r => setTimeout(r, 160));

      // 9 — Morph to SOLD with spin
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
     // 11 — Arc home (flip back to orange bag at midpoint)
      controls.start({
        x:      [onAny.x, (onAny.x + start.x) / 2 + 50, start.x],
        y:      [onAny.y, onAny.y - 140, start.y],
        scaleX: [1, 0.78, 1],
        scaleY: [1, 1.22, 1],
        rotate: [1080, 990, 900],
        transition: { duration: 0.58, ease: ease.outExpo, times: [0, 0.42, 1] },
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

      onComplete();
    };

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {burst && <ParticleExplosion x={burst.x} y={burst.y} />}
      <motion.div
        animate={controls}
        initial={{ x: start.x, y: start.y, rotate: 0, scaleX: 1, scaleY: 1 }}
        style={{ position: 'fixed', top: 0, left: 0, width: W, height: H, zIndex: 9999, pointerEvents: 'none' }}
      >
        <motion.div
          style={{
            width: '100%', height: '100%', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: sold ? '#16a34a' : '#f97316',
            transition: 'background-color 0.15s ease',
            overflow: 'hidden',
          }}
          animate={sold ? { boxShadow: ['0 0 0px rgba(22,163,74,0)', '0 0 24px rgba(22,163,74,0.7)', '0 0 0px rgba(22,163,74,0)'] } : {}}
          transition={{ duration: 0.7, repeat: 2 }}
        >
          <AnimatePresence mode="wait">
            {!sold ? (
              <motion.div key="bag"
                initial={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.2, rotate: 180 }}
                transition={{ duration: 0.13 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag style={{ width: 22, height: 22, color: 'white' }} />
              </motion.div>
            ) : (
              <motion.div key="sold"
                initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: ease.elastic }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <Sparkles style={{ width: 10, height: 10, color: 'white' }} />
                <span style={{ color: 'white', fontWeight: 800, fontSize: 9, letterSpacing: '0.03em', fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
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

// ─── NudgeWord ─────────────────────────────────────────────────────────────────

function NudgeWord({ children, nudge, className, innerRef }: {
  children: React.ReactNode; nudge: boolean; className?: string; innerRef?: React.RefObject<HTMLSpanElement>;
}) {
  return (
    <motion.span
      className={className}
      animate={nudge ? { y: [0, 8, -3, 2, 0], scaleY: [1, 0.88, 1.04, 0.97, 1] } : { y: 0, scaleY: 1 }}
      transition={{ duration: 0.48, ease: ease.elastic }}
      style={{ display: 'inline-block', transformOrigin: 'bottom center' }}
    >
      <span ref={innerRef}>{children}</span>
          </motion.span>
  );
}
function FlipText({ first, second, className }: { first: string; second: string; className?: string }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    // Wait for hero to settle, then start flipping every 3s
    const initial = setTimeout(() => {
      setFlipped(true);
      const interval = setInterval(() => {
        setFlipped(prev => !prev);
      }, 3000);
      return () => clearInterval(interval);
    }, 2000);
    return () => clearTimeout(initial);
  }, []);

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className={className}
      style={{ display: 'inline-block', perspective: 800 }}
    >
      <AnimatePresence mode="wait">
        {!flipped ? (
          <motion.span
            key="first"
            initial={{ rotateX: 90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: -90, opacity: 0 }}
            transition={{ duration: 0.4, ease: ease.outExpo }}
            style={{ display: 'inline-block', transformOrigin: 'center' }}
          >
            {first}
          </motion.span>
        ) : (
          <motion.span
            key="second"
            initial={{ rotateX: 90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: -90, opacity: 0 }}
            transition={{ duration: 0.4, ease: ease.outExpo }}
            style={{ display: 'inline-block', transformOrigin: 'center' }}
          >
            {second}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
}

// ─── Hero sub-components ───────────────────────────────────────────────────────

function StoreCard() {
  return (
    <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xl shadow-orange-500/5">
      <div className="h-32 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
        <ShoppingBag className="w-10 h-10 text-white/90" />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-orange-600 font-bold text-xs">Q</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">Your Store</p>
            <p className="text-xs text-gray-400 mt-0.5">qafrica.store/yourstore</p>
          </div>
        </div>
        <div className="space-y-1.5 mb-3">
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full w-3/4" />
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full w-1/2" />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="h-12 bg-orange-50 dark:bg-orange-950/30 rounded-lg" />
          <div className="h-12 bg-orange-50 dark:bg-orange-950/30 rounded-lg" />
          <div className="h-12 bg-orange-50 dark:bg-orange-950/30 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function SalesChip() {
  return (
    <div className="flex items-center gap-3 w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 shadow-lg shadow-black/5">
      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
        <TrendingUp className="w-4 h-4 text-green-600" />
      </div>
      <div>
        <p className="text-xs text-gray-400 leading-none mb-0.5">Today's sales</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">₦125,000</p>
      </div>
    </div>
  );
}

function OrderChip() {
  return (
    <div className="flex items-center gap-3 w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 shadow-lg shadow-black/5">
      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
        <ShoppingBag className="w-4 h-4 text-blue-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 leading-none mb-0.5">New order</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Just now</p>
      </div>
    </div>
  );
}

// ─── LandingPage ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [isScrolled, setIsScrolled]             = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq]                   = useState<number | null>(null);

  const navLogoBoxRef = useRef<HTMLDivElement>(null);
  const sellRef       = useRef<HTMLSpanElement>(null);
  const anythingRef   = useRef<HTMLSpanElement>(null);

  const [animRects, setAnimRects]           = useState<{ start: DOMRect; sell: DOMRect; any: DOMRect } | null>(null);
  const [animDone, setAnimDone]             = useState(false);
  // Only the logo BOX fades out while flying; the "QAFRICA" text is always visible
  const [logoBoxVisible, setLogoBoxVisible] = useState(false);
  const [sellNudge, setSellNudge]           = useState(false);
  const [anyNudge, setAnyNudge]             = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      if (!navLogoBoxRef.current || !sellRef.current || !anythingRef.current) return;
      setAnimRects({
        start: navLogoBoxRef.current.getBoundingClientRect(),
        sell:  sellRef.current.getBoundingClientRect(),
        any:   anythingRef.current.getBoundingClientRect(),
      });
    }, 400);
    return () => clearTimeout(id);
  }, []);

  const handleAnimComplete = () => {
    setAnimDone(true);
    setLogoBoxVisible(true);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {animRects && !animDone && (
        <FlyingLogo
          startRect={animRects.start}
          sellRect={animRects.sell}
          anyRect={animRects.any}
          onComplete={handleAnimComplete}
          onSellHit={() => setSellNudge(true)}
          onAnyHit={() => setAnyNudge(true)}
        />
      )}

      <SEO
        title="QAFRICA — Build & Grow Your Online Store in Nigeria"
        description="QAFRICA is Nigeria's leading e-commerce platform. Create a beautiful online store in minutes, import products, manage orders, and accept secure payments. Built for Nigerian entrepreneurs."
        keywords={['Nigerian e-commerce platform','online store Nigeria','sell online Nigeria','create online store Nigeria','Nigerian marketplace','Naira payment online store','e-commerce Lagos','QAFRICA','dropshipping Nigeria','Nigerian online business']}
        url="https://qafrica.store"
        type="website"
      />
      <OrganizationSchema />

      {/* ── Navigation ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-lg shadow-sm' : 'bg-transparent'}`}>
        <div className="container-custom">
          <div className="flex items-center justify-between h-16 lg:h-20">

            <Link to="/" className="flex items-center gap-2">
              {/*
                Logo BOX: opacity 0 while the flying logo is in flight.
                The box still occupies its space (no layout shift), the
                text stays visible the whole time.
              */}
              <motion.div
                ref={navLogoBoxRef}
                animate={{ opacity: logoBoxVisible ? 1 : 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center"
              >
                <ShoppingBag className="w-6 h-6 text-white" />
              </motion.div>
              {/* "QAFRICA" text — always visible, never animated away */}
              <span className="text-xl font-bold text-gray-900 dark:text-white">QAFRICA</span>
            </Link>

            <div className="hidden lg:flex items-center gap-8">
              <Link to="/stores" className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors">Browse Stores</Link>
              <button onClick={() => scrollToSection('features')} className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors">Features</button>
              <button onClick={() => scrollToSection('pricing')}  className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors">Pricing</button>
              <button onClick={() => scrollToSection('faq')}      className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors">FAQ</button>
            </div>

            <div className="hidden lg:flex items-center gap-4">
              <DarkModeToggle />
              <Link to="/login"><Button variant="ghost" className="text-gray-600 dark:text-gray-300 hover:text-orange-600">Sign In</Button></Link>
              <Link to="/customer/login"><Button variant="ghost" className="text-gray-600 dark:text-gray-300 hover:text-orange-600">Shopper Login</Button></Link>
              <Link to="/signup"><Button className="bg-orange-500 hover:bg-orange-600 text-white">Start Free Trial</Button></Link>
            </div>

            <button className="lg:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="lg:hidden bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800"
          >
            <div className="container-custom py-4 space-y-4">
              <Link to="/stores" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-gray-600 dark:text-gray-300">Browse Stores</Link>
              <button onClick={() => scrollToSection('features')} className="block w-full text-left py-2 text-gray-600 dark:text-gray-300">Features</button>
              <button onClick={() => scrollToSection('pricing')}  className="block w-full text-left py-2 text-gray-600 dark:text-gray-300">Pricing</button>
              <button onClick={() => scrollToSection('faq')}      className="block w-full text-left py-2 text-gray-600 dark:text-gray-300">FAQ</button>
              <hr className="border-gray-100 dark:border-gray-800" />
              <Link to="/login"          onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-gray-600 dark:text-gray-300">Sign In</Link>
              <Link to="/customer/login" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-gray-600 dark:text-gray-300">Shopper Login</Link>
              <Link to="/signup"><Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">Start Free Trial</Button></Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* ══════════════════════════════════════════
          ── Hero ──

          pt-36  mobile  (144px) = 64px nav + 80px buffer so the
                                   bounce animation never clips nav
          pt-48  desktop (192px) = 80px nav + 112px buffer
      ══════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-start lg:items-center bg-white dark:bg-gray-950 overflow-hidden pt-36 pb-20 lg:pt-48 lg:pb-32">

        {/* Left accent bar — desktop only */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-32 bg-orange-500 hidden lg:block" />

        <div className="container-custom relative z-10 w-full">
          <div className="flex items-center justify-between gap-16">

            {/* ── Left: text ── */}
            <div className="flex-1 lg:pl-12">

        <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight mb-6"
              >
                <NudgeWord nudge={sellNudge} innerRef={sellRef}>Scale</NudgeWord>{' '}
                <NudgeWord nudge={anyNudge} className="text-orange-500" innerRef={anythingRef}>smoothly.</NudgeWord>
                <br />
             <FlipText
                  first="Fast payments."
                  second="It's giving profit."
                  third="Your business buddy."
                  className="text-gray-400 dark:text-gray-500"
                />
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.9 }}
                className="text-base text-gray-400 dark:text-gray-500 mb-10 max-w-sm leading-relaxed"
              >
                Dropship products and access ready-made promo content from sellers' group chats. Grow your retailer base — all on QAFRICA.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.1 }}
                className="space-y-2 mb-0"
              >
                <Link to="/signup">
                  <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-6 text-lg rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-shadow">
                    Start Your Store — Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <p className="text-sm text-gray-400 pl-1">₦5,000/month after trial · Cancel anytime</p>
              </motion.div>

              {/* ── Mobile only: store card + chips after the ₦5k line ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.25 }}
                className="mt-8 flex flex-col gap-3 lg:hidden"
              >
                <StoreCard />
                {/* Chips stretch to fill the full row equally */}
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0"><SalesChip /></div>
                  <div className="flex-1 min-w-0"><OrderChip /></div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.4 }}
                className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800"
              >
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Trusted by sellers in</p>
                <div className="flex flex-wrap gap-5 text-sm text-gray-400 dark:text-gray-500">
                  <span>Lagos</span><span>Abuja</span><span>Kano</span><span>Port Harcourt</span><span>Ibadan</span>
                </div>
              </motion.div>
            </div>

            {/* ── Right: desktop card + floating chips ── */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
              className="hidden lg:block relative flex-shrink-0"
              style={{ width: 280 }}
            >
              {/* Sales chip — top-left overhang */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.05 }}
                className="absolute z-10 w-52"
                style={{ top: 24, left: -80 }}
              >
                <SalesChip />
              </motion.div>

              <StoreCard />

              {/* Order chip — bottom-right overhang */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                className="absolute z-10 w-48"
                style={{ bottom: 32, right: -60 }}
              >
                <OrderChip />
              </motion.div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 bg-gray-900">
        <div className="container-custom">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <p className="text-3xl lg:text-4xl font-bold text-orange-500 mb-2">{stat.value}</p>
                <p className="text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 lg:py-32">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-medium mb-4">Features</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Everything You Need to Sell Online</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">Purpose-built tools for Nigerian entrepreneurs — from store setup to order fulfilment and payments.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="group p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-orange-500 transition-colors duration-300">
                  <f.icon className="w-7 h-7 text-orange-500 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{f.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Niches ── */}
      <section id="niches" className="py-20 lg:py-32 bg-orange-50 dark:bg-gray-900">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1 bg-orange-200 text-orange-700 rounded-full text-sm font-medium mb-4">Niches</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Built for Your Industry</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">Each niche comes with tailored themes, relevant features, and a curated product catalog ready to import.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {niches.map((niche, i) => (
              <motion.div key={niche.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="group p-6 bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-orange-300 hover:shadow-lg transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-500 transition-colors">
                  <ShoppingBag className="w-6 h-6 text-orange-500 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{niche.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{niche.description}</p>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/signup">
              <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                Explore All Niches <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 lg:py-32">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-medium mb-4">How It Works</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Live in 4 Simple Steps</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Create Account',    desc: 'Sign up in seconds with your email. No credit card required.' },
              { step: '02', title: 'Choose Your Niche', desc: 'Pick the industry that matches your products and get a tailored store.' },
              { step: '03', title: 'Set Up Your Store', desc: 'Add your products, pick a theme, and customize your brand.' },
              { step: '04', title: 'Start Selling',     desc: 'Publish your store and start receiving orders with secure payments.' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative">
                <div className="text-6xl font-bold text-orange-100 dark:text-orange-950 mb-4">{item.step}</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{item.desc}</p>
                {i < 3 && <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-orange-100 dark:bg-orange-950" />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 lg:py-32 bg-gray-50 dark:bg-gray-900">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-medium mb-4">Pricing</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Simple, Transparent Pricing in Naira</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">No hidden fees. No foreign exchange surprises. Cancel anytime.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingTiers.map((tier, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`relative p-8 rounded-2xl ${tier.popular ? 'bg-white dark:bg-gray-950 border-2 border-orange-500 shadow-xl scale-105' : 'bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800'}`}>
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-orange-500 text-white text-sm font-medium rounded-full">Most Popular</span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{tier.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{tier.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">₦{tier.price}</span>
                  <span className="text-gray-500 dark:text-gray-400">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup">
                  <Button className={`w-full ${tier.popular ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'}`}>
                    {tier.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-20 lg:py-32">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-medium mb-4">Testimonials</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Real Stories from Nigerian Sellers</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(t.rating)].map((_, j) => <Star key={j} className="w-5 h-5 text-yellow-400 fill-yellow-400" />)}
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6 italic">"{t.content}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 font-bold">{t.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{t.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 lg:py-32 bg-gray-50 dark:bg-gray-900">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-medium mb-4">FAQ</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <button className="w-full text-left px-6 py-4 flex items-center justify-between font-semibold text-gray-900 dark:text-white hover:text-orange-600 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {faq.q}
                  <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3">{faq.a}</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 lg:py-32">
        <div className="container-custom">
          <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl p-12 lg:p-20 overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
            </div>
            <div className="relative z-10 text-center max-w-2xl mx-auto">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Your Store. Your Customers. Your Revenue.</h2>
              <p className="text-lg text-orange-100 mb-8">Join Nigerian entrepreneurs already growing their business on QAFRICA. Start your free trial today — no credit card needed.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/signup">
                  <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 px-8">Start Free Trial <ArrowRight className="w-5 h-5 ml-2" /></Button>
                </Link>
                <Link to="/stores">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">Browse Stores</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">QAFRICA</span>
              </div>
              <p className="text-gray-400 mb-4">Empowering Nigerian entrepreneurs to build, grow, and scale their online businesses.</p>
              <div className="flex items-center gap-4">
                <a href="#" aria-label="Website"   className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-orange-500 transition-colors"><Globe className="w-5 h-5" /></a>
                <a href="#" aria-label="Community" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-orange-500 transition-colors"><Users className="w-5 h-5" /></a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2">
                <li><button onClick={() => scrollToSection('features')} className="text-gray-400 hover:text-orange-500 transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('pricing')}  className="text-gray-400 hover:text-orange-500 transition-colors">Pricing</button></li>
                <li><Link to="/stores"  className="text-gray-400 hover:text-orange-500 transition-colors">Browse Stores</Link></li>
                <li><Link to="/signup"  className="text-gray-400 hover:text-orange-500 transition-colors">Start Free Trial</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href={`mailto:${CONFIG.PLATFORM_EMAIL}`} className="text-gray-400 hover:text-orange-500 transition-colors">Contact Us</a></li>
                <li><button onClick={() => scrollToSection('faq')} className="text-gray-400 hover:text-orange-500 transition-colors">FAQ</button></li>
                <li><Link to="/developer/docs" className="text-gray-400 hover:text-orange-500 transition-colors">Developer API</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Email: {CONFIG.PLATFORM_EMAIL}</li>
                <li>Based in Nigeria</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">© {new Date().getFullYear()} QAFRICA. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/privacy-policy"   className="text-gray-400 hover:text-white text-sm transition-colors">Privacy Policy</Link>
              <Link to="/terms-of-service" className="text-gray-400 hover:text-white text-sm transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}