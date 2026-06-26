// src/pages/import/ImportPage.tsx
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, ArrowRight, Store, BookOpen,
  Search, ShoppingCart, Zap, MessageCircle,
  Calculator, Package, CreditCard, TrendingUp,
  Shield, Globe, CheckCircle,
} from 'lucide-react';

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="bg-white pt-8 pb-14 px-4 overflow-hidden">
      <div className="max-w-2xl mx-auto">

        {/* 2-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center mb-10">

          {/* Left — 60% */}
          <div className="md:col-span-3">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 text-xs font-bold px-3 py-1.5 rounded-full mb-5">
              <Globe className="w-3.5 h-3.5" />
              Powered by 1688.com
            </div>

            <h1 className="text-2xl font-black text-gray-900 leading-tight mb-5 text-left">
              We help you safely import from China's largest wholesale platform,{' '}
              <span className="text-orange-500">1688.</span>
            </h1>

            <p className="text-gray-500 text-sm leading-relaxed mb-7 text-left max-w-sm">
              We can help you source from verified vendors on 1688. View our catalog
              for recommended products that sell best on Jumia. Or visit 1688.com and
              send us screenshots — we'll handle the rest.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Link
                to="/recommendations"
                className="inline-flex items-center justify-center gap-2 py-3 px-5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors text-sm"
              >
                View Recommended Items
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/marketplaces"
                className="inline-flex items-center justify-center gap-2 py-3 px-5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                <Store className="w-4 h-4" />
                Want to sell on Jumia?
              </Link>
            </div>

            <p className="text-xs text-gray-400">
              Not sure what to import?{' '}
              <Link to="/blog" className="text-orange-500 font-semibold hover:underline">
                Read our guide →
              </Link>
            </p>
          </div>

          {/* Right — 40% hero image */}
          <div className="md:col-span-2 flex items-center justify-center">
            <div className="relative w-full max-w-[260px] mx-auto">
              {/* Glow / shadow behind image */}
              <div className="absolute inset-0 rounded-2xl bg-orange-100 blur-2xl opacity-60 scale-95 translate-y-2" />
              <img
                src="https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.5249362888645752.webp"
                alt="Import products from China"
                className="relative w-full rounded-2xl object-cover shadow-xl"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    icon: Search,
    title: 'Browse & Pick',
    desc: 'View our catalog and pick recommended bestseller items.',
  },
  {
    icon: ShoppingCart,
    title: 'Add to Cart',
    desc: 'Add your selected items to your order.',
  },
  {
    icon: Zap,
    title: 'Generate Code',
    desc: 'Get your unique order code instantly.',
  },
  {
    icon: MessageCircle,
    title: 'Send on WhatsApp',
    desc: 'Tap the WhatsApp link and send us your code.',
  },
  {
    icon: Calculator,
    title: 'We Calculate',
    desc: 'We prepare a comprehensive bill for your shipment.',
  },
  {
    icon: Package,
    title: 'Choose Fulfillment',
    desc: 'Ship to your address or our warehouse to sell on Jumia.',
  },
  {
    icon: CreditCard,
    title: 'Pay & Ship',
    desc: 'Make payment and your order is on its way.',
  },
  {
    icon: TrendingUp,
    title: 'Earn Payouts',
    desc: 'Watch your sales and revenue come in.',
  },
];

function HowItWorks() {
  return (
    <section className="bg-gray-50 px-4 py-14">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-2">
            How It Works
          </p>
          <h2 className="text-xl font-black text-gray-900">
            From browsing to payouts — 8 simple steps
          </h2>
        </div>

        {/* Step grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className="bg-white rounded-xl p-4 border border-gray-100 relative"
              >
                {/* Step number */}
                <span className="absolute top-3 right-3 text-[10px] font-black text-gray-200">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-orange-500" />
                </div>
                <p className="font-bold text-gray-900 text-xs mb-1">{step.title}</p>
                <p className="text-gray-400 text-[11px] leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Connector line hint on desktop */}
        <div className="hidden sm:flex items-center justify-center mt-6 gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-orange-500' : 'bg-gray-200'}`} />
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Why Trust Us ──────────────────────────────────────────────────────────────
const TRUST_POINTS = [
  {
    icon: Shield,
    title: 'Verified vendors only',
    desc: 'Every supplier we work with is vetted on 1688 before we place a single order.',
  },
  {
    icon: CheckCircle,
    title: 'Quality checked',
    desc: 'We inspect every shipment before it leaves our warehouse or reaches you.',
  },
  {
    icon: Globe,
    title: 'End-to-end logistics',
    desc: 'Customs, compliance, packaging — all handled so you don't have to.',
  },
  {
    icon: TrendingUp,
    title: 'Jumia-ready fulfillment',
    desc: 'We list and fulfill on Jumia for you, no Lagos drop-off hub needed.',
  },
];

function WhyTrustUs() {
  return (
    <section className="bg-white px-4 py-14">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-2">
            Why Trust Us?
          </p>
          <h2 className="text-xl font-black text-gray-900 mb-4">
            Built to close the gap between you and the world's largest wholesale market.
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-lg">
            We are just starting out, and we built this platform because we noticed a
            massive gap that stops many aspiring business owners from selling on top
            marketplaces. Platforms like Jumia, Konga, and Jiji attract millions of
            visitors every month — yet many entrepreneurs miss out because they don't
            have access to vendor drop-off hubs in Lagos, or they're overwhelmed by
            packaging mandates and logistics.
          </p>
          <p className="text-gray-500 text-sm leading-relaxed max-w-lg mt-3">
            We built QAFRICA to bridge that exact gap — handling the entire procurement
            process, cutting lengthy shipping timelines, tackling compliance, and bringing
            Lagos fulfilment infrastructure directly to your fingertips.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TRUST_POINTS.map((pt, i) => {
            const Icon = pt.icon;
            return (
              <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm mb-1">{pt.title}</p>
                  <p className="text-gray-400 text-xs leading-relaxed">{pt.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 bg-orange-500 rounded-2xl p-6 text-white text-center">
          <p className="font-black text-lg mb-1">Ready to start importing?</p>
          <p className="text-orange-100 text-sm mb-5">
            Browse our curated catalog of products that sell best on Jumia.
          </p>
          <Link
            to="/recommendations"
            className="inline-flex items-center gap-2 bg-white text-orange-500 font-bold px-6 py-3 rounded-xl text-sm hover:bg-orange-50 transition-colors"
          >
            View Recommended Items
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ImportPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Single sticky nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500 rounded-md flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">QAFRICA Import</span>
          </Link>
          <Link
            to="/blog"
            className="text-xs text-gray-500 hover:text-orange-500 font-medium flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Blog
          </Link>
        </div>
      </header>

      <Hero />
      <HowItWorks />
      <WhyTrustUs />
    </div>
  );
}
