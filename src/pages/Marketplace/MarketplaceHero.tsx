// src/pages/Marketplace/MarketplaceHero.tsx

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const JUMIA_LOGO  = 'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.09368732789771816.webp';
const KONGA_LOGO  = 'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.14995787725112708.webp';
const JIJI_LOGO   = 'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.4026806338820781.webp';

const platforms = [
  { name: 'Jumia', logo: JUMIA_LOGO, reach: '3M+ monthly', pillLabel: 'Largest',    pillClass: 'bg-orange-50 text-orange-700' },
  { name: 'Konga', logo: KONGA_LOGO, reach: '1M+ monthly', pillLabel: 'Growing',    pillClass: 'bg-pink-50   text-pink-700'   },
  { name: 'Jiji',  logo: JIJI_LOGO,  reach: '2M+ monthly', pillLabel: 'Classifieds', pillClass: 'bg-green-50  text-green-700'  },
];

const stats = [
  { val: '5M+', lbl: 'Monthly buyers across platforms' },
  { val: '1×',  lbl: 'Bulk shipment from you'          },
  { val: '3×',  lbl: 'Platforms selling for you'       },
];

export default function MarketplaceHero() {
  return (
    <section className="min-h-screen flex flex-col overflow-hidden" style={{ background: '#FAFAFA' }}>
      <div
        className="flex-1 grid lg:grid-cols-2 gap-10 w-full max-w-6xl mx-auto px-7 items-center"
        style={{ minHeight: 'calc(100vh - 60px)', paddingTop: 60 }}
      >

        {/* ── LEFT: Copy ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="py-14"
        >
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-3.5 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">
              Fulfilment · Nigeria
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-black leading-none tracking-tighter text-gray-900 dark:text-white mb-4"
            style={{ fontSize: 'clamp(32px, 4vw, 50px)', letterSpacing: '-1.8px', lineHeight: 1.06 }}
          >
            Send your stock once.<br />
            We sell it on{' '}
            <span className="text-orange-500">all 3</span><br />
            marketplaces.
          </h1>

          {/* Sub */}
          <p className="text-sm text-gray-500 leading-relaxed mb-7 max-w-md">
            Jumia, Konga & Jiji command{' '}
            <strong className="text-gray-800 dark:text-gray-200 font-semibold">over 5M monthly buyers</strong>
            {' '}— but vendors burn out chasing Lagos drop-offs and listing deadlines.
            <br /><br />
            <strong className="text-gray-800 dark:text-gray-200 font-semibold">Ship your bulk stock to us.</strong>
            {' '}We list, pack, and deliver every order across Nigeria. When stock runs low, we reach out to resupply.
          </p>

          {/* Platform logo row */}
          <div className="flex items-center gap-2.5 flex-wrap mb-8">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mr-1">Sell on:</span>
            {[
              { src: JUMIA_LOGO, alt: 'Jumia' },
              { src: KONGA_LOGO, alt: 'Konga' },
              { src: JIJI_LOGO,  alt: 'Jiji'  },
            ].map(p => (
              <div
                key={p.alt}
                className="h-8 bg-white border border-gray-200 rounded-lg px-2.5 flex items-center shadow-sm"
              >
                <img src={p.src} alt={p.alt} className="h-[22px] w-auto object-contain block" />
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div
            className="flex max-w-md mb-8 bg-white border border-gray-200 rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            {stats.map((s, i) => (
              <div
                key={s.lbl}
                className="flex-1 px-4 py-3.5"
                style={{ borderRight: i < stats.length - 1 ? '1px solid #E2E8F0' : 'none' }}
              >
                <p className="text-xl font-black text-gray-900 dark:text-white leading-none tracking-tight">{s.val}</p>
                <p className="text-[10px] text-gray-400 mt-1 leading-snug font-medium">{s.lbl}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-4 flex-wrap mb-3.5">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-px"
              style={{ boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#how" className="text-sm text-gray-400 hover:text-orange-500 transition-colors font-medium">
              See how it works ↓
            </a>
          </div>

          <p className="text-[11px] text-gray-400">
            <span className="text-green-600 font-semibold">✓ Free to list</span>
            {' '}· We only earn when you sell · Cancel anytime
          </p>
        </motion.div>

        {/* ── RIGHT: Flow diagram ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="hidden lg:flex items-center justify-center relative py-14"
        >
          {/* BG glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, #FFF7ED 0%, transparent 70%)' }}
          />

          {/* Stock-alert toast — top right */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3.5 }}
            className="absolute top-4 -right-2 z-20 bg-white border border-orange-200 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5"
            style={{ boxShadow: '0 4px 20px rgba(249,115,22,0.12)' }}
          >
            <span className="text-lg flex-shrink-0">📩</span>
            <div>
              <p className="text-xs font-bold text-gray-900">Restock alert sent</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Ankara Bags — 3 units left · Kano seller</p>
            </div>
          </motion.div>

          <div className="relative z-10 flex flex-col items-center w-full max-w-sm">

            {/* Vendor node */}
            <div
              className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3.5 flex items-center gap-3 z-10"
              style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}
            >
              <span className="text-3xl leading-none">📦</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">Your bulk stock</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Ship once from anywhere in Nigeria</p>
              </div>
              <span className="flex-shrink-0 bg-green-50 border border-green-200 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                ✓ Nationwide
              </span>
            </div>

            {/* Connector → warehouse badge */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-7" style={{ background: 'linear-gradient(to bottom, #E2E8F0, #F97316)' }} />
              <div
                className="bg-white border border-orange-200 rounded-full px-3 py-1 text-[10px] font-semibold text-orange-700 flex items-center gap-1.5 my-1.5 whitespace-nowrap z-10"
                style={{ boxShadow: '0 2px 10px rgba(249,115,22,0.15)' }}
              >
                🏭 We receive &amp; warehouse your stock
              </div>
              <div className="w-0.5 h-7" style={{ background: 'linear-gradient(to bottom, #F97316, #E2E8F0)' }} />
              {/* Arrow */}
              <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #F97316' }} />
            </div>

            {/* Hub */}
            <div className="relative my-1 z-10">
              {/* Spinning dashed ring */}
              <div
                className="absolute rounded-full border-2 border-dashed border-orange-200"
                style={{ inset: -10, animation: 'spin 16s linear infinite' }}
              />
              <div
                className="w-[90px] h-[90px] bg-orange-500 rounded-[22px] flex flex-col items-center justify-center relative z-10"
                style={{ boxShadow: '0 8px 30px rgba(249,115,22,0.35)' }}
              >
                {/* Layers icon */}
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[8px] font-extrabold text-white/80 uppercase tracking-widest mt-1">QAfrica</span>
              </div>
            </div>

            {/* Connector → delivery badge */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-7" style={{ background: 'linear-gradient(to bottom, #F97316, #E2E8F0)' }} />
              <div
                className="bg-white border border-orange-200 rounded-full px-3 py-1 text-[10px] font-semibold text-orange-700 flex items-center gap-1.5 my-1.5 whitespace-nowrap z-10"
                style={{ boxShadow: '0 2px 10px rgba(249,115,22,0.15)' }}
              >
                🚚 We pack &amp; deliver each order
              </div>
              <div className="w-0.5 h-7 bg-gray-200" />
              <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #F97316' }} />
            </div>

            {/* Platform cards */}
            <div className="flex gap-2.5 justify-center z-10 mt-1">
              {platforms.map((p, i) => (
                <motion.div
                  key={p.name}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.6, ease: 'easeInOut' }}
                  className="bg-white border border-gray-200 rounded-2xl py-3.5 px-2.5 flex flex-col items-center gap-2 w-[108px] cursor-default"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                >
                  <div className="h-9 flex items-center justify-center">
                    <img src={p.logo} alt={p.name} className="max-h-9 max-w-[80px] w-auto object-contain" />
                  </div>
                  <p className="text-[11px] font-bold text-gray-900">{p.name}</p>
                  <p className="text-[9px] text-gray-400 text-center">{p.reach}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.pillClass}`}>
                    {p.pillLabel}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Live order toast — bottom right */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.5 }}
            className="absolute bottom-4 -right-2 z-20 bg-white border border-gray-200 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-gray-900">Order fulfilled · Jumia</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Hair Extensions · ₦18,500 · Delivered</p>
            </div>
          </motion.div>
        </motion.div>

      </div>

      {/* Spin keyframe — injected globally once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
