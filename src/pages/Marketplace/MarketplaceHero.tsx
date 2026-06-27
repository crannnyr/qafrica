// src/pages/Marketplace/MarketplaceHero.tsx

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import RopeCanvas from './RopeCanvas';

export default function MarketplaceHero() {
  return (
    <section className="min-h-screen flex flex-col lg:flex-row pt-16 overflow-hidden">

      {/* ── Left: Copy ── */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-16 lg:py-24 relative">

        {/* Left accent bar — desktop */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-20 bg-orange-500 rounded-r hidden lg:block" />

        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-full px-3 py-1.5 w-fit mb-5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-xs font-semibold text-orange-600">
            Multi-Marketplace · Nigeria
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight mb-3"
        >
          Post Once.<br/>
          Sell on{' '}
          <span className="text-orange-500">Jumia,</span><br/>
          Konga & Jiji.
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="text-sm text-gray-400 dark:text-gray-500 mb-5 leading-relaxed max-w-xs"
        >
          One listing. Four channels. Zero extra work.
        </motion.p>

        {/* Platform chips */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="flex items-center gap-2 flex-wrap mb-6"
        >
          <span className="text-xs text-gray-400 font-medium">Live on:</span>
          {[
            { label: 'JUMIA', color: 'text-orange-700 bg-orange-50 border-orange-200'  },
            { label: 'KONGA', color: 'text-pink-700   bg-pink-50   border-pink-200'    },
            { label: 'JIJI',  color: 'text-green-700  bg-green-50  border-green-200'   },
          ].map(p => (
            <span
              key={p.label}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${p.color}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {p.label}
            </span>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="flex gap-5 mb-7 pb-6 border-b border-gray-100 dark:border-gray-800 flex-wrap"
        >
          {[
            { val: '3M+',  lbl: 'Daily Jumia visitors' },
            { val: '1',    lbl: 'Upload needed'        },
            { val: '4×',   lbl: 'More reach'           },
            { val: '20%',  lbl: 'Total fees'           },
          ].map(s => (
            <div key={s.lbl}>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                {s.val}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.lbl}</p>
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="flex items-center gap-4 flex-wrap"
        >
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5"
          >
            Start Selling Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#how"
            className="text-sm text-gray-400 hover:text-orange-500 transition-colors flex items-center gap-1"
          >
            See how it works ↓
          </a>
        </motion.div>

        {/* Micro trust */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.65 }}
          className="mt-4 text-[11px] text-gray-400"
        >
          <span className="text-green-600 font-semibold">✓ Free trial</span>
          {' '}· No credit card · Cancel anytime
        </motion.p>
      </div>

      {/* ── Right: Rope canvas — desktop only ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="hidden lg:block relative"
        style={{ width: 480, flexShrink: 0 }}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800" />

        {/* Dot grid decoration */}
        <div className="absolute top-6 right-6 grid grid-cols-4 gap-1.5 opacity-10">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-gray-900 dark:bg-white block" />
          ))}
        </div>

        {/* Canvas */}
        <div className="absolute inset-0">
          <RopeCanvas />
        </div>

        {/* Live order notification */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ delay: 2.5 }}
          className="absolute bottom-8 right-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg"
        >
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-white">
              New order · Jumia
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Hair Extensions · ₦18,500
            </p>
          </div>
        </motion.div>
      </motion.div>

    </section>
  );
}