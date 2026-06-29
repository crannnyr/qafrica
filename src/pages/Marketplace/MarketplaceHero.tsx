// src/pages/Marketplace/MarketplaceHero.tsx

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShoppingBag, BookOpen, X, Globe, Package, Store, Zap, Users } from 'lucide-react';

const JUMIA_LOGO = 'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.09368732789771816.webp';
const KONGA_LOGO = 'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.14995787725112708.webp';
const JIJI_LOGO  = 'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.4026806338820781.webp';

const platforms = [
  { name: 'Jumia', logo: JUMIA_LOGO, reach: '3M+ monthly',  pillLabel: 'Largest',     pillClass: 'bg-orange-50 text-orange-700' },
  { name: 'Konga', logo: KONGA_LOGO, reach: '1M+ monthly',  pillLabel: 'Growing',     pillClass: 'bg-pink-50 text-pink-700'     },
  { name: 'Jiji',  logo: JIJI_LOGO,  reach: '2M+ monthly',  pillLabel: 'Classifieds', pillClass: 'bg-green-50 text-green-700'   },
];

const stats = [
  { val: '5M+', lbl: 'Monthly buyers' },
  { val: '1×',  lbl: 'Bulk shipment'  },
  { val: '3×',  lbl: 'Platforms'      },
];

export default function MarketplaceHero() {
  const prefersReducedMotion = useReducedMotion();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500 rounded-md flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">
              QAFRICA <span className="text-orange-500">Push</span>
            </span>
          </Link>
          <Link
            to="/blog"
            className="text-xs text-gray-500 hover:text-orange-500 font-medium flex items-center gap-1 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Blog
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{ background: '#FAFAFA' }}>
        <div className="w-full max-w-6xl mx-auto px-5 sm:px-7 grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">

          {/* ── LEFT: Copy ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="pt-10 pb-6 lg:py-14"
          >
            {/* Platform logo bar */}
            <div className="flex items-center gap-2 flex-wrap mb-6">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Sell on:</span>
              {[
                { src: JUMIA_LOGO, alt: 'Jumia' },
                { src: KONGA_LOGO, alt: 'Konga' },
                { src: JIJI_LOGO,  alt: 'Jiji'  },
              ].map(p => (
                <div
                  key={p.alt}
                  className="h-10 bg-white border border-gray-200 rounded-xl px-3 flex items-center shadow-sm"
                >
                  <img src={p.src} alt={p.alt} className="h-[26px] w-auto object-contain block" />
                </div>
              ))}
            </div>

            {/* Headline */}
            <h1
              className="font-black tracking-tighter text-gray-900 mb-4 text-left"
              style={{ fontSize: 'clamp(26px, 3.2vw, 40px)', letterSpacing: '-1.4px', lineHeight: 1.08 }}
            >
              Send your stock once.<br />
              We sell it on{' '}
              <span className="text-orange-500">all 3</span><br />
              marketplaces.
            </h1>

            {/* Sub */}
            <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-md text-left">
              Jumia, Konga & Jiji command{' '}
              <strong className="text-gray-800 font-semibold">over 5M monthly buyers</strong>
              {' '}— but vendors burn out chasing Lagos drop-offs and listing deadlines.
              <br /><br />
              <strong className="text-gray-800 font-semibold">Ship your bulk stock to us.</strong>
              {' '}We list, pack, and deliver every order across Nigeria.
            </p>

            {/* Stats row */}
            <div
              className="flex max-w-xs sm:max-w-md mb-7 bg-white border border-gray-200 rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              {stats.map((s, i) => (
                <div
                  key={s.lbl}
                  className="flex-1 px-3 sm:px-4 py-3"
                  style={{ borderRight: i < stats.length - 1 ? '1px solid #E2E8F0' : 'none' }}
                >
                  <p className="text-lg sm:text-xl font-black text-gray-900 leading-none tracking-tight">{s.val}</p>
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

            {/* Free to list line */}
            <p className="text-[11px] text-gray-400 mb-3">
              <span className="text-green-600 font-semibold">✓ Free to list</span>
              {' '}· We only earn when you sell · Cancel anytime
            </p>

            {/* Blinking Website & Dropshipping button */}
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-orange-500 text-orange-600 font-bold text-sm transition-all hover:bg-orange-50"
              style={{ animation: 'blink-border 1.4s ease-in-out infinite' }}
            >
              <Globe className="w-4 h-4" />
              Website & Dropshipping
            </button>
          </motion.div>

          {/* ── RIGHT: Flow diagram ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative flex flex-col items-center pb-8 lg:py-14"
          >
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, #FFF7ED 0%, transparent 70%)' }}
            />

            <div className="relative z-10 flex flex-col items-center w-full max-w-[340px]">

              <div
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3.5 flex items-center gap-3"
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

              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6" style={{ background: 'linear-gradient(to bottom, #E2E8F0, #F97316)' }} />
                <div
                  className="bg-white border border-orange-200 rounded-full px-3 py-1 text-[10px] font-semibold text-orange-700 flex items-center gap-1.5 my-1.5 whitespace-nowrap"
                  style={{ boxShadow: '0 2px 10px rgba(249,115,22,0.15)' }}
                >
                  🏭 We receive &amp; warehouse your stock
                </div>
                <div className="w-0.5 h-6" style={{ background: 'linear-gradient(to bottom, #F97316, #E2E8F0)' }} />
                <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #F97316' }} />
              </div>

              <div className="relative my-1">
                {!prefersReducedMotion && (
                  <div
                    className="absolute rounded-full border-2 border-dashed border-orange-200"
                    style={{ inset: -10, animation: 'hubSpin 16s linear infinite' }}
                  />
                )}
                <div
                  className="w-[80px] h-[80px] bg-orange-500 rounded-[20px] flex flex-col items-center justify-center relative z-10"
                  style={{ boxShadow: '0 8px 30px rgba(249,115,22,0.35)' }}
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[8px] font-extrabold text-white/80 uppercase tracking-widest mt-1">QAfrica</span>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6" style={{ background: 'linear-gradient(to bottom, #F97316, #E2E8F0)' }} />
                <div
                  className="bg-white border border-orange-200 rounded-full px-3 py-1 text-[10px] font-semibold text-orange-700 flex items-center gap-1.5 my-1.5 whitespace-nowrap"
                  style={{ boxShadow: '0 2px 10px rgba(249,115,22,0.15)' }}
                >
                  🚚 We pack &amp; deliver each order
                </div>
                <div className="w-0.5 h-6 bg-gray-200" />
                <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #F97316' }} />
              </div>

              <div className="flex gap-2 justify-center mt-1 w-full">
                {platforms.map((p, i) => (
                  <motion.div
                    key={p.name}
                    animate={prefersReducedMotion ? {} : { y: [0, -5, 0] }}
                    transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.6, ease: 'easeInOut' }}
                    className="bg-white border border-gray-200 rounded-2xl py-3 px-2 flex flex-col items-center gap-1.5 flex-1 cursor-default"
                    style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                  >
                    <div className="h-8 flex items-center justify-center">
                      <img src={p.logo} alt={p.name} className="max-h-8 max-w-[68px] w-auto object-contain" />
                    </div>
                    <p className="text-[11px] font-bold text-gray-900">{p.name}</p>
                    <p className="text-[9px] text-gray-400 text-center">{p.reach}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.pillClass}`}>
                      {p.pillLabel}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col gap-2 w-full mt-4">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.4 }}
                  className="bg-white border border-gray-200 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 w-full"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                >
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-gray-900">Order fulfilled · Jumia</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Hair Extensions · ₦18,500 · Delivered</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8, duration: 0.4 }}
                  className="bg-white border border-orange-200 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 w-full"
                  style={{ boxShadow: '0 4px 20px rgba(249,115,22,0.1)' }}
                >
                  <span className="text-base flex-shrink-0">📩</span>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Restock alert sent</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Ankara Bags — 3 units left · Kano seller</p>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{   opacity: 0, scale: 0.92, y: 20  }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">

                {/* Modal header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-5 flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-white" />
                    <h2 className="text-white font-bold text-lg">Website & Dropshipping</h2>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal body */}
                <div className="px-6 py-5 space-y-5">
                  
                  <p className="text-sm text-gray-600 leading-relaxed">
                    You are about to be routed to our <strong className="text-gray-900">Store Owner section</strong> where you get access to:
                  </p>

                  {/* ── NEW HIGHLIGHTED NOTE BANNER ── */}
                  <div className="relative overflow-hidden bg-orange-50 border border-orange-100 rounded-xl p-4 shadow-sm">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
                    <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-1.5">
                      <span className="text-base">🚀</span> Multiply Your Sales
                    </h3>
                    <p className="text-xs text-orange-700/90 leading-relaxed">
                      Set a special <strong>Dropshipping Price</strong> (a discount margin) for your products. Then, connect your <strong>WhatsApp or Telegram group link</strong>. When dropshippers want to resell your items, they join your group to get your contact and share your products to other platforms — bringing you effortless sales!
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Feature 1 */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-50 text-gray-600">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Your Own Website</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Get a full storefront — buy and connect your own custom domain.
                        </p>
                      </div>
                    </div>

                    {/* Feature 2 */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-50 text-blue-600">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Dropshipping Network</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          List your products so other store owners can import and sell them for you across their own websites.
                        </p>
                      </div>
                    </div>

                    {/* Feature 3 */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-50 text-purple-600">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Group Chat & Reseller Community
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          Automate your communication by funneling interested resellers directly into your community chats.
                        </p>
                      </div>
                    </div>

                    {/* Feature 4 */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-50 text-green-600">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Push to Jumia, Konga & Jiji</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Sync your products directly to Nigeria's top marketplaces.{' '}
                          <strong className="text-gray-700">Requires an active subscription.</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal footer */}
                <div className="px-6 pb-6 flex items-center gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <Link
                    to="/store-owners"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm text-center transition-colors flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes hubSpin { to { transform: rotate(360deg); } }
        @keyframes blink-border {
          0%, 100% { border-color: #f97316; box-shadow: 0 0 0 0 rgba(249,115,22,0); }
          50%       { border-color: #ea580c; box-shadow: 0 0 0 4px rgba(249,115,22,0.2); }
        }
      `}</style>
    </>
  );
}
