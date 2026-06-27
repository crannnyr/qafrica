// src/pages/blog/BlogPostPage.tsx

import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Clock, Tag, ArrowRight,
  ShoppingBag, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { getBySlug, getRelated } from './posts/index';

// ── CTA routing matrix ────────────────────────────────────────────────────────
// All CTAs across articles map to exactly one destination.
// Never guess — derive from this single source of truth.

type CtaContext = 'importations' | 'marketplaces' | 'signup';

const CTA_ROUTES: Record<CtaContext, string> = {
  importations: '/importations',   // China / dropshipping / procurement guides
  marketplaces: '/marketplaces',   // Jumia / Konga / Jiji / marketplace content
  signup:       '/signup',         // Store creation / niche / general onboarding
};

// ── Shared blog UI primitives ─────────────────────────────────────────────────

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-8 border-l-4 border-orange-500 pl-5 py-1">
      <p className="text-lg font-semibold text-gray-800 leading-relaxed italic">
        {children}
      </p>
    </div>
  );
}

function InfoBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="my-6 bg-orange-50 border border-orange-100 rounded-xl p-5">
      <p className="text-sm font-bold text-orange-700 mb-3">{title}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800 leading-relaxed">{children}</p>
    </div>
  );
}

function CtaBanner({ headline, sub, context }: {
  headline: string;
  sub: string;
  context: CtaContext;
}) {
  return (
    <div className="my-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-7 text-white">
      <ShoppingBag className="w-8 h-8 mb-3 opacity-90" />
      <h3 className="text-lg font-bold mb-2">{headline}</h3>
      <p className="text-orange-100 text-sm mb-5 leading-relaxed">{sub}</p>
      <a
        href={CTA_ROUTES[context]}
        className="inline-flex items-center gap-2 bg-white text-orange-600 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-orange-50 transition-colors"
      >
        Get Started — No Credit Card
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}

function StepCard({ number, title, description }: {
  number: string; title: string; description: string;
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
        <span className="text-white font-black text-sm">{number}</span>
      </div>
      <div>
        <p className="font-bold text-gray-900 mb-1">{title}</p>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── FAQ accordion ─────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-orange-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-orange-500 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-4 bg-white border-t border-gray-50">
          <p className="text-sm text-gray-600 leading-relaxed pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

function FaqSection({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="my-10">
      <h2 className="text-xl font-bold text-gray-900 mb-5">
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <FaqItem key={i} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  );
}

// ── Supply chain diagram (default — used by QC / marketplace articles) ────────

function SupplyChainDiagram() {
  return (
    <div className="my-8 bg-gray-50 rounded-2xl p-6 overflow-x-auto">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 text-center">
        How QAFRICA Works
      </p>
      <div className="flex items-center justify-center gap-2 min-w-max mx-auto">
        {[
          { label: 'China\nSupplier',    color: 'bg-blue-100 text-blue-700 border-blue-200',     emoji: '🏭' },
          { label: 'QAFRICA\nQC Check 1',color: 'bg-orange-100 text-orange-700 border-orange-200',emoji: '🔍' },
          { label: 'QAFRICA\nQC Check 2',color: 'bg-orange-200 text-orange-800 border-orange-300',emoji: '✅' },
          { label: 'Jumia\nKonga · Jiji',color: 'bg-green-100 text-green-700 border-green-200',   emoji: '🛒' },
          { label: 'Your\nStore',        color: 'bg-purple-100 text-purple-700 border-purple-200',emoji: '🏪' },
        ].map((node, i, arr) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`border rounded-xl px-4 py-3 text-center ${node.color}`}>
              <div className="text-2xl mb-1">{node.emoji}</div>
              <div className="text-xs font-semibold whitespace-pre-line leading-tight">
                {node.label}
              </div>
            </div>
            {i < arr.length - 1 && (
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-8 h-px bg-gray-300" />
                <ArrowRight className="w-3 h-3 text-gray-400 -mt-1" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dropshipping pipeline diagram (5-step user journey) ──────────────────────

function DropshippingPipelineDiagram() {
  const steps = [
    {
      emoji:  '🛍️',
      label:  'Select',
      detail: 'Browse QAFRICA catalog or 1688 app',
      color:  'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      emoji:  '💬',
      label:  'Submit & Price',
      detail: 'Send items to QAFRICA — get full pricing back',
      color:  'bg-orange-50 text-orange-700 border-orange-200',
    },
    {
      emoji:  '✈️',
      label:  'Pay & Ship',
      detail: 'Pay once — products move from China to Nigeria',
      color:  'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      emoji:  '🏪',
      label:  'Storage Choice',
      detail: 'QAFRICA fulfilment warehouse OR your own storage',
      color:  'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      emoji:  '🚀',
      label:  'Go Live & Sell',
      detail: 'Auto-listed on Jumia, Konga, Jiji — orders processed automatically',
      color:  'bg-green-50 text-green-700 border-green-200',
    },
  ];

  return (
    <div className="my-8 bg-gray-50 rounded-2xl p-6">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 text-center">
        Your China → Nigeria Pipeline
      </p>

      {/* Desktop: horizontal flow */}
      <div className="hidden md:flex items-start justify-center gap-2 overflow-x-auto">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`border rounded-xl px-3 py-3 text-center w-32 ${step.color}`}>
              <div className="text-2xl mb-1">{step.emoji}</div>
              <p className="text-xs font-bold leading-tight mb-1">{step.label}</p>
              <p className="text-xs leading-tight opacity-80">{step.detail}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-6 h-px bg-gray-300" />
                <ArrowRight className="w-3 h-3 text-gray-400 -mt-1" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical flow */}
      <div className="md:hidden space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className={`border rounded-xl p-2.5 ${step.color}`}>
                <span className="text-xl">{step.emoji}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-px h-4 bg-gray-200" />
              )}
            </div>
            <div className="pt-2">
              <p className="text-sm font-bold text-gray-900">{step.label}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top products table ─────────────────────────────────────────────────────────

function TopProductsTable() {
  const products = [
    { rank: 1,  name: 'Phone Cases & Accessories', margin: '60–80%', demand: '🔥 Very High' },
    { rank: 2,  name: 'Hair Extensions & Wigs',    margin: '50–70%', demand: '🔥 Very High' },
    { rank: 3,  name: 'Skincare & Beauty',          margin: '55–75%', demand: '🔥 Very High' },
    { rank: 4,  name: 'Shapewear & Waist Trainers', margin: '50–65%', demand: '⚡ High'      },
    { rank: 5,  name: 'Sneakers & Footwear',        margin: '40–60%', demand: '⚡ High'      },
    { rank: 6,  name: 'Kitchen Appliances',         margin: '35–55%', demand: '⚡ High'      },
    { rank: 7,  name: 'Baby Products',              margin: '45–65%', demand: '⚡ High'      },
    { rank: 8,  name: "Men's Clothing",             margin: '40–60%', demand: '📈 Growing'   },
    { rank: 9,  name: 'Bluetooth Gadgets',          margin: '50–70%', demand: '📈 Growing'   },
    { rank: 10, name: 'Home Décor',                 margin: '45–65%', demand: '📈 Growing'   },
  ];

  return (
    <div className="my-8 overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">#</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Product</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Margin</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Demand</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {products.map((p) => (
            <tr key={p.rank} className="hover:bg-orange-50/40 transition-colors">
              <td className="px-4 py-3 font-bold text-orange-500">{p.rank}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
              <td className="px-4 py-3 text-green-600 font-semibold">{p.margin}</td>
              <td className="px-4 py-3 text-gray-600">{p.demand}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Post content per slug ─────────────────────────────────────────────────────

function PostContent({ slug }: { slug: string }) {

  // ── 1. What sells best on Jumia ───────────────────────────────────────────
  if (slug === 'what-sells-best-on-jumia-2026') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Jumia processed over <strong>3 million orders</strong> in Nigeria last quarter alone.
        But not every product sells equally — and most new sellers waste months listing the
        wrong things. We analysed the top-performing categories so you know exactly where to
        focus your energy and your money from day one.
      </p>

      <PullQuote>
        The best-selling products on Jumia share one thing: they solve an everyday
        Nigerian problem at a price point anyone can say yes to.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Top 10 Best-Selling Products on Jumia Nigeria (2026)
      </h2>

      <TopProductsTable />

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Why These Products Keep Winning
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Every category in that table shares three traits Jumia's algorithm rewards:
        high search volume, repeat purchase potential, and wide demographic appeal.
        Phone accessories, for example, are purchased by virtually every smartphone
        owner — and Nigeria has over 100 million smartphone users and counting.
        That's not a niche. That's a market.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        What's more, these products are <strong>lightweight, affordable and photographable</strong> —
        three things Jumia's ranking system actively favours when deciding whose listings
        to show first. This is not a coincidence. The platform is designed to push products
        with low return rates to the top. Focus there and the algorithm works for you.
      </p>

      <InfoBox
        title="What makes a Jumia bestseller?"
        items={[
          'Lightweight and easy to ship — reduces return rates and Jumia penalties',
          'Under ₦15,000 — sits firmly inside the Nigerian impulse-buy threshold',
          'Solves a problem buyers already know they have',
          'Photographable — looks compelling on a product listing',
          "Low return rate — Jumia rewards accounts that don't generate complaints",
        ]}
      />

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        The Part Most Sellers Miss
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Knowing what sells is only half the equation. The other half is sourcing it
        at a margin that actually makes sense. Buying from local wholesalers in Lagos
        or Onitsha puts you in a race to the bottom with hundreds of sellers buying
        from the same place at the same price. The sellers consistently making money
        on Jumia source closer to the manufacturer — which means China.
      </p>
      <p className="text-gray-600 leading-relaxed mb-6">
        That's where QAFRICA comes in. We source directly from verified Chinese
        manufacturers, warehouse everything in Nigeria, run two rounds of quality
        control, then list on Jumia on your behalf. You set your selling price.
        We handle the rest. When an order drops, we pick, pack and ship it. The margin is yours.
      </p>

      <SupplyChainDiagram />

      <CtaBanner
        context="marketplaces"
        headline="Start selling Jumia's top products today"
        sub="No inventory risk. No warehouse needed. QAFRICA sources, QCs and lists for you on Jumia, Konga and Jiji — you collect your margin every time an order ships."
      />
    </div>
  );

  // ── 2. How to sell on Jumia without getting banned ────────────────────────
  if (slug === 'how-to-sell-on-jumia-without-getting-banned') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Jumia suspends or permanently bans thousands of seller accounts every month.
        The most common reason isn't fraud — it's <strong>quality violations</strong>.
        A single batch of substandard products can end your entire Jumia career. And once
        the ban hammer falls, there's rarely a second chance.
      </p>

      <WarningBox>
        Jumia's seller policy states that three quality-related complaints within 30 days
        can trigger an automatic account review. Five complaints can result in permanent
        suspension with no appeal process. Most sellers who get banned never see it coming.
      </WarningBox>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Why Sellers Get Banned (And It's Not What You Think)
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        The majority of bans don't happen because sellers are dishonest. They happen
        because sellers trusted an unverified supplier, received a bad batch, listed it
        anyway, and let their customers find out the hard way. By the time the complaints
        hit, it's too late.
      </p>

      <InfoBox
        title="Most common reasons for Jumia seller bans"
        items={[
          'Products don\'t match the listing description or photos',
          'Items arrive damaged due to poor or missing packaging',
          'Counterfeit or "grade B" items passed off as original',
          'Missing accessories or incomplete product sets',
          'Late fulfilment — Jumia heavily penalises slow shipping',
          'Listing in wrong categories or using prohibited keywords',
        ]}
      />

      <PullQuote>
        Most bans are 100% avoidable. The problem isn't the seller — it's the supplier
        they never actually verified.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        The 2-Layer QC System That Protects Your Account
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        At QAFRICA, every product passes through two independent quality checks before
        it ever appears on a Jumia listing. This isn't optional — it's baked into our
        fulfilment process. You don't have to remember it. We never skip it.
      </p>

      <SupplyChainDiagram />

      <div className="my-6 space-y-4">
        <StepCard
          number="1"
          title="QC Check One — At Arrival"
          description="When goods arrive from our Chinese suppliers, every batch is inspected at our receiving warehouse. We verify quantity, packaging integrity, product condition, and check against the original specification sheet. Anything that doesn't pass goes straight back."
        />
        <StepCard
          number="2"
          title="QC Check Two — Before Listing"
          description="A second independent team reviews a sample from each batch before any product is listed. They verify that product photos match the real item, confirm dimensions, test functionality where applicable, and ensure packaging meets Jumia's precise standards."
        />
        <StepCard
          number="3"
          title="Listing Review — Accuracy Check"
          description="Our listing team writes product descriptions that are accurate, detailed and Jumia-compliant. Misleading listings are the fastest route to an account ban — ours never are. Every title, bullet and image is reviewed before it goes live."
        />
      </div>

      <InfoBox
        title="What QAFRICA's QC protects you from"
        items={[
          'Receiving wrong or damaged products from Chinese suppliers',
          'Accidentally listing items that violate Jumia\'s category rules',
          'Poor packaging that causes in-transit damage and returns',
          'Photo mismatches that trigger buyer complaints',
          'Account health score drops from avoidable quality failures',
          'Jumia penalties for slow fulfilment — we ship fast, every time',
        ]}
      />

      <p className="text-gray-600 leading-relaxed mb-4">
        The result? QAFRICA-listed products maintain a <strong>sub-1% complaint rate</strong> across
        Jumia, Konga and Jiji. Your account health stays clean. Jumia keeps showing your
        listings. You keep making sales.
      </p>

      <CtaBanner
        context="marketplaces"
        headline="Sell on Jumia safely — we handle every compliance check"
        sub="Our 2-layer QC system has kept QAFRICA seller accounts clean across Jumia, Konga and Jiji. Start selling with confidence — no QC expertise needed on your side."
      />
    </div>
  );

  // ── 3. Dropshipping from China to Nigeria ─────────────────────────────────
  if (slug === 'dropshipping-from-china-to-nigeria') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        China manufactures most of what Nigerians buy online today. The difference
        between sellers making 60% margins and those scraping 10% is simple:
        <strong> how close they are to the source</strong>. QAFRICA gives every Nigerian
        seller direct access to verified Chinese manufacturers — with none of the
        usual risk, confusion or middlemen markup.
      </p>

      <PullQuote>
        You don't need to travel to China, speak Mandarin or wire money to a stranger
        online. QAFRICA manages the entire import pipeline — you just pick what you want to sell.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Step 1: Finding Your Products
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        You have two ways to source with QAFRICA — and you can use both at the same time.
      </p>

      <div className="my-6 grid sm:grid-cols-2 gap-4">
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-5">
          <p className="text-sm font-bold text-orange-700 mb-2">📦 QAFRICA Catalog</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Our curated catalog contains thousands of products pre-vetted for quality,
            demand and margin potential in the Nigerian market. Every item is ready to
            import with one click — no research needed, no supplier hunting.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <p className="text-sm font-bold text-blue-700 mb-2">🔎 Browse 1688 Yourself</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Prefer to hunt for deals yourself? Browse 1688 directly, screenshot
            the products you like and send them to QAFRICA. We'll source, verify
            and import them for you. Our team handles the rest.
          </p>
        </div>
      </div>

      <WarningBox>
        If you browse 1688 yourself, only send products to QAFRICA for sourcing — never
        pay a supplier on 1688 directly. Scammers are common on the platform. QAFRICA's
        team verifies every supplier before any money moves. Let us protect your cash.
      </WarningBox>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        How the Full Pipeline Works — End to End
      </h2>

      <DropshippingPipelineDiagram />

      <div className="my-6 space-y-4">
        <StepCard
          number="1"
          title="Select Your Products"
          description="Browse QAFRICA's curated catalog or search 1688 directly and screenshot products that interest you. There's no minimum order — you can start with as little as one product line."
        />
        <StepCard
          number="2"
          title="Submit to QAFRICA for Pricing"
          description="Send your product list or screenshots to QAFRICA. We calculate and return a comprehensive price breakdown — product cost, shipping, customs, QC and fulfilment fees. No hidden numbers. You see exactly what you're working with before committing."
        />
        <StepCard
          number="3"
          title="Pay Once — Products Move"
          description="Once you're happy with the pricing, make your payment. Your products are ordered from the verified supplier and shipped from China to Nigeria. We track every shipment and keep you updated at each stage."
        />
        <StepCard
          number="4"
          title="Choose Your Storage Arrangement"
          description="When your goods arrive in Nigeria, you decide: store them in QAFRICA's managed fulfilment warehouse (we handle pick, pack and dispatch automatically) — or route inventory to your own private storage space. Either way, we connect your stock to the sales channels seamlessly."
        />
        <StepCard
          number="5"
          title="Go Live — Sales Run on Autopilot"
          description="Your products are listed on Jumia, Konga and Jiji simultaneously, plus your own QAFRICA storefront. When an order comes in, it's processed and dispatched automatically. Margins hit your QAFRICA wallet. You scale."
        />
      </div>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Flexible Storage: QAFRICA Fulfilment or Your Own
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Unlike most import platforms that lock you into one storage model, QAFRICA
        gives you complete flexibility over where your inventory lives.
      </p>

      <div className="my-6 grid sm:grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-100 rounded-xl p-5">
          <p className="text-sm font-bold text-green-700 mb-2">🏭 QAFRICA Fulfilment</p>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            Store with us and we handle everything: receiving, QC, shelving, picking,
            packing and dispatching every order. You never touch the product. Ideal
            for sellers who want completely hands-off operations.
          </p>
          <ul className="space-y-1">
            {['Fully managed pick & pack','Automatic order dispatch','Jumia/Konga/Jiji integrated'].map((i, idx) => (
              <li key={idx} className="flex items-center gap-2 text-xs text-green-700">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />{i}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
          <p className="text-sm font-bold text-purple-700 mb-2">🏠 Your Own Storage</p>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            Prefer to manage inventory yourself? Redirect your goods to your own private
            warehouse, shop or home storage. You control fulfilment, and QAFRICA still
            handles your multi-channel listings and order routing.
          </p>
          <ul className="space-y-1">
            {['Full inventory control','Lower per-unit storage cost','Multi-channel listings still managed'].map((i, idx) => (
              <li key={idx} className="flex items-center gap-2 text-xs text-purple-700">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />{i}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        What Products Work Best from China?
      </h2>

      <InfoBox
        title="Highest-margin China-sourced categories for Nigeria"
        items={[
          'Phone accessories — cases, chargers, earphones (60–80% margin)',
          'Beauty and skincare — serums, tools, cosmetics (55–75%)',
          'Hair products — extensions, wigs, accessories (50–70%)',
          'Kitchen gadgets — air fryers, blenders, organisers (40–60%)',
          'Fashion accessories — belts, bags, jewellery (50–70%)',
          'Baby products — feeding, clothing, toys (45–65%)',
        ]}
      />

      <WarningBox>
        QAFRICA's QC team rejects roughly 12% of incoming batches that don't meet our
        quality standards. That rejection rate is your protection — it's what keeps
        your Jumia account clean and your customers coming back.
      </WarningBox>

      <CtaBanner
        context="importations"
        headline="Start importing from China — without leaving Nigeria"
        sub="Browse our catalog or send us 1688 screenshots. We calculate your price, handle shipping, QC and warehousing — you decide where to store and which channels to sell on."
      />
    </div>
  );

  // ── 4. How to create an online store in Nigeria ───────────────────────────
  if (slug === 'how-to-create-online-store-nigeria') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Creating an online store in Nigeria used to mean hiring a developer,
        waiting weeks and spending hundreds of thousands of naira before making
        a single sale. In 2026, you can go from zero to a live, selling store in
        under 10 minutes — no code, no designer, no technical knowledge required.
        And with QAFRICA, your store does something no other platform in Nigeria offers.
      </p>

      <PullQuote>
        The fastest-growing Nigerian online businesses were built by people with
        no tech background. The barrier is lower than you think — and the upside
        is bigger than most people realise.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Step-by-Step: Launch Your Nigerian Online Store
      </h2>

      <div className="my-6 space-y-4">
        <StepCard
          number="1"
          title="Sign Up on QAFRICA — Free"
          description="Create your account with just an email address. No credit card needed. Your free trial starts immediately with full access to every feature — browse the catalog, build your store, set your prices."
        />
        <StepCard
          number="2"
          title="Choose Your Niche"
          description="Pick the category that fits your products. QAFRICA has tailored themes, curated catalog sections and niche-specific features for fashion, electronics, beauty, baby products and more."
        />
        <StepCard
          number="3"
          title="Name Your Store and Get Your URL"
          description="Your store gets a free qafrica.store/yourname URL the moment you sign up. On paid plans, connect your own custom domain — yourstore.com — in two clicks."
        />
        <StepCard
          number="4"
          title="Add Products"
          description="Upload your own products or browse QAFRICA's catalog and add items with a single click. For catalog products, descriptions, photos and competitive pricing are already handled."
        />
        <StepCard
          number="5"
          title="Set Your Prices and Dropship Margins"
          description="Price your products however you like. For every product in your store, you also set a dropship price — a wholesale rate that lets other QAFRICA entrepreneurs import your items into their own stores. Every time they sell your product, you earn without lifting a finger."
        />
        <StepCard
          number="6"
          title="Go Live and Start Selling Everywhere"
          description="Hit publish and your store is live instantly. Share your link, run ads — or let QAFRICA push your products to Jumia, Konga and Jiji automatically. One upload, four active sales channels."
        />
      </div>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        The B2B Advantage: Turn Your Store Into a Wholesale Network
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        This is the feature that separates QAFRICA from every other Nigerian e-commerce
        platform — and most sellers don't fully understand the power of it until they
        see the numbers.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        When you list products on your QAFRICA store, other entrepreneurs across the
        network can <strong>import those exact products into their own storefronts</strong> to
        dropship. They set their own retail price above your dropship price and keep their
        margin. You collect your wholesale rate automatically — no negotiation, no chasing
        payments, no extra work.
      </p>

      <div className="my-6 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-6">
        <p className="text-sm font-bold text-orange-700 mb-4">💡 How the B2B margin works</p>
        <div className="space-y-3">
          {[
            { label: 'You source a product',              value: '₦3,000 cost',           color: 'text-gray-600' },
            { label: 'You list it at',                    value: '₦7,000 retail',          color: 'text-gray-800' },
            { label: 'You set dropship price at',         value: '₦5,000',                 color: 'text-orange-600' },
            { label: 'Network seller adds their margin → retails at', value: '₦8,000+',   color: 'text-gray-800' },
            { label: 'You earn on every sale they make',  value: '₦2,000 passive income',  color: 'text-green-600 font-bold' },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-orange-100 last:border-0">
              <span className="text-sm text-gray-600">{row.label}</span>
              <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Scale this across 20 network sellers each making 5 sales a day — and your
          passive wholesale income runs independently of your own storefront sales.
        </p>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Source Directly from China — Right From Your Store Dashboard
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Your store doesn't sit in isolation. It's connected directly to QAFRICA's
        China procurement pipeline. If you find a product on 1688 you want to list,
        submit it through your dashboard. QAFRICA will source it, ship it, QC it and
        add it to your store — ready to push live on Jumia, Konga and Jiji.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        This means your store can grow continuously without you having to travel,
        negotiate with suppliers or manage shipping logistics. You identify opportunities.
        We execute. You sell on four channels simultaneously.
      </p>

      <InfoBox
        title="What's included on every QAFRICA store"
        items={[
          'Free qafrica.store subdomain — custom domain available on paid plans',
          'Paystack and direct bank transfer payment processing built in',
          '7-day escrow protection on every order for buyer and seller security',
          'Mobile-optimised storefront that loads fast on any Nigerian network',
          'Order management, tracking and fulfilment dashboard',
          'Real-time sales and traffic analytics',
          'B2B dropship network — earn passive wholesale income from the QAFRICA community',
          'One-click product push to Jumia, Konga and Jiji',
          'Direct China procurement access from your store dashboard',
        ]}
      />

      <CtaBanner
        context="signup"
        headline="Launch your Nigerian online store in 10 minutes"
        sub="Free to start. No credit card. Your store, your prices, your margins — backed by QAFRICA's procurement, QC and multi-channel distribution network."
      />

      <FaqSection items={[
        {
          q: 'How do I start selling on Jumia, Konga or Jiji from my QAFRICA store?',
          a: 'Once your store is set up on QAFRICA, you can push your products to Jumia, Konga and Jiji with a single click from your dashboard. QAFRICA manages the listings, keeps inventory synced and routes orders back to your fulfilment queue automatically. No separate seller accounts needed for each platform.',
        },
        {
          q: 'What payment methods can my Nigerian customers use?',
          a: 'Every QAFRICA store comes with Paystack integrated out of the box — accepting cards, bank transfers, USSD and mobile money. Customers can also pay via direct bank transfer. All payments are held in a 7-day escrow to protect both parties before funds are released to your wallet.',
        },
        {
          q: 'How does shipping work for my customers across Nigeria?',
          a: 'If you use QAFRICA fulfilment, we handle all shipping to your customers across Nigeria — Lagos, Abuja, Port Harcourt and beyond. If you manage your own storage, you arrange delivery using your preferred courier. QAFRICA integrates with major Nigerian logistics providers so tracking updates automatically.',
        },
        {
          q: 'Do I need to buy stock upfront to start my store?',
          a: 'No. With QAFRICA\'s dropship model, you list products and only procure them when an order comes in. You can also browse and import products from other QAFRICA sellers into your store — no inventory cost, no minimum order. Capital is only needed when you choose to hold physical stock for faster fulfilment.',
        },
        {
          q: 'Can other sellers really dropship my products without my permission?',
          a: 'No seller can import your products without seeing your published dropship price — which you set. You control whether your products appear in the QAFRICA dropship network, and you set the minimum wholesale price other sellers must pay. Every sale they make triggers an automatic payout to your QAFRICA wallet.',
        },
        {
          q: 'How do I source products from China through my QAFRICA store?',
          a: 'You can browse QAFRICA\'s curated catalog directly from your dashboard and add products in one click. Alternatively, screenshot or copy a link from 1688 and submit it through the procurement tool. QAFRICA verifies the supplier, calculates your landed cost (product + shipping + customs + QC) and sends you a quote before anything is ordered.',
        },
        {
          q: 'Is QAFRICA suitable for first-time online sellers in Nigeria?',
          a: 'Absolutely. QAFRICA was built for sellers who are starting from scratch — no technical skills, no prior e-commerce experience, no existing supplier relationships required. The platform guides you from store setup through your first product listing to your first sale. Thousands of Nigerian entrepreneurs have launched on QAFRICA with zero prior experience.',
        },
        {
          q: 'What does it cost to list on Jumia or Konga through QAFRICA?',
          a: 'QAFRICA handles Jumia, Konga and Jiji listings as part of your subscription. The marketplaces themselves charge commission on sales (typically 5–15% depending on category) — these are standard rates every seller pays. QAFRICA does not add a markup on top of marketplace commissions.',
        },
      ]} />
    </div>
  );

  // ── 5. Best niches Nigeria 2026 ───────────────────────────────────────────
  if (slug === 'best-niches-nigeria-2026') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Choosing the right niche is the single most important decision you'll make
        as an online seller in Nigeria. Pick wrong and you'll fight for every sale
        against hundreds of established competitors. Pick right and the market comes
        to you — repeat buyers, strong margins, growing demand. Here are the 10 most
        profitable niches in Nigeria right now, backed by real transaction data.
      </p>

      <PullQuote>
        The most profitable niche isn't always the most popular one — it's where
        demand is real, supply is beatable, and margins stay healthy.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Top 10 Niches to Sell Online in Nigeria (2026)
      </h2>

      <div className="my-6 space-y-3">
        {[
          { rank: '01', niche: 'Hair & Beauty',        why: 'Repeat purchase guaranteed. Nigerian women spend more on hair than any other category. Consistent monthly revenue from a loyal customer base.' },
          { rank: '02', niche: 'Phone Accessories',    why: 'Nigeria has 100M+ smartphone users. Every new phone means new accessories bought immediately. Near-zero return rate makes this a platform favourite.' },
          { rank: '03', niche: 'Fashion & Clothing',   why: 'The largest category by volume on every Nigerian marketplace. Massive catalog, many untapped micro-niches — menswear, plus-size, workwear all underserved.' },
          { rank: '04', niche: 'Skincare & Cosmetics', why: 'Premium margins. Nigerian consumers are increasingly brand-conscious and willing to pay for quality. Strong performance on Jumia, Konga and Instagram.' },
          { rank: '05', niche: 'Baby & Kids',          why: 'Parents are the most reliable spenders online. Low price sensitivity for child-related products. Strong repeat purchase rate as children grow.' },
          { rank: '06', niche: 'Kitchen Appliances',   why: 'Air fryers, blenders and storage organisers are booming. Nigeria\'s growing middle class is investing in home upgrades for the first time.' },
          { rank: '07', niche: 'Footwear',             why: 'Sneaker culture is massive in Nigeria. Strong margins on imported styles. Social media drives huge demand — one viral post can clear your stock.' },
          { rank: '08', niche: 'Home & Living',        why: 'Growing fast with urbanisation in Lagos, Abuja and Port Harcourt. Décor, storage and organisation products all outperforming expectations.' },
          { rank: '09', niche: 'Fitness & Wellness',   why: 'Health awareness has shifted permanently post-2020. Resistance bands, supplements, home gym equipment and wellness products all growing 30%+ year on year.' },
          { rank: '10', niche: 'Electronics & Gadgets',why: 'High ticket value means fewer sales needed to hit revenue targets. Bluetooth speakers, smart home devices and gaming accessories are the fastest-growing sub-categories.' },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-orange-200 transition-colors">
            <span className="text-2xl font-black text-orange-200 flex-shrink-0 w-10">{item.rank}</span>
            <div>
              <p className="font-bold text-gray-900 mb-1">{item.niche}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{item.why}</p>
            </div>
          </div>
        ))}
      </div>

      <InfoBox
        title="How to validate your niche before you commit"
        items={[
          'Search the category on Jumia — count sellers and review volumes. High reviews = proven demand.',
          'Check Google Trends Nigeria over 12 months — stable or growing interest only.',
          'Look at the top 3 sellers — can you source the same product cheaper via QAFRICA?',
          'Calculate your realistic margin — aim for at least 40% after platform fees and shipping.',
          'Start with 5–10 SKUs, not 100 — focus beats breadth for new stores every time.',
        ]}
      />

      <CtaBanner
        context="signup"
        headline="Pick your niche and start selling today"
        sub="QAFRICA has tailored themes, curated catalogs and direct China supplier connections for every niche on this list. Start your free trial and make your first sale today."
      />
    </div>
  );

  // ── 6. Sell on Jumia Konga Jiji at same time ──────────────────────────────
  if (slug === 'sell-on-jumia-konga-jiji-nigeria') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Most Nigerian sellers pick one marketplace and hope for the best. Savvy sellers
        list everywhere simultaneously — and let the platforms compete to sell their
        products for them. QAFRICA makes this possible without doubling your workload.
        One upload. Four live channels. Automated order routing.
      </p>

      <PullQuote>
        A product listed on Jumia, Konga and Jiji simultaneously gets 3–5x the
        exposure of a single-channel listing — with no extra work on your end.
      </PullQuote>

      <SupplyChainDiagram />

      <InfoBox
        title="What QAFRICA manages across all your channels"
        items={[
          'Unified product listing — upload once, push to all platforms',
          'Inventory sync — stock levels update across Jumia, Konga, Jiji and your store in real time',
          'Order consolidation — all orders from all channels appear in one dashboard',
          'Platform-specific optimisation — titles, descriptions and images formatted for each marketplace',
          'Jumia, Konga and Jiji compliance checks handled automatically',
        ]}
      />

      <CtaBanner
        context="marketplaces"
        headline="List on Jumia, Konga and Jiji — all from one place"
        sub="One dashboard. Four channels. Automated listings, inventory sync and order routing. Stop leaving sales on the table."
      />
    </div>
  );

  // ── 7. Import from China without freight agent ────────────────────────────
  if (slug === 'import-products-from-china-nigeria') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Traditional importation from China meant finding a freight agent, negotiating
        in broken English, wiring money to an account you couldn't verify, and praying
        your goods arrived in one piece. In 2026, QAFRICA eliminates every one of those
        steps. You pick products. We import them.
      </p>

      <PullQuote>
        You don't need a clearing agent, a forwarder or a contact in Guangzhou.
        QAFRICA is your end-to-end China import department.
      </PullQuote>

      <DropshippingPipelineDiagram />

      <InfoBox
        title="What QAFRICA handles for every import"
        items={[
          'Supplier verification and negotiation — we only buy from vetted manufacturers',
          'Two-stage quality control before any product is listed or shipped',
          'China-to-Nigeria shipping and customs clearance',
          'Warehousing in Nigeria — or routing to your own storage',
          'Listing on Jumia, Konga, Jiji and your QAFRICA storefront',
          'Pick, pack and dispatch on every order',
        ]}
      />

      <WarningBox>
        Thinking of ordering directly from 1688 yourself? It's possible — but the
        platform is in Mandarin, payments require a Chinese bank account or proxy
        service, and unverified sellers are common. Send us the screenshots instead.
        We source safely on your behalf.
      </WarningBox>

      <CtaBanner
        context="importations"
        headline="Import from China — without the stress"
        sub="Browse our catalog or send us product screenshots. We quote, source, ship, QC and warehouse everything. You sell. We execute."
      />
    </div>
  );

  return null;
}

// ── Related posts ─────────────────────────────────────────────────────────────

function RelatedPosts({ slug, category }: { slug: string; category: string }) {
  const related = getRelated(slug, category);
  if (related.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t border-gray-100">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
        Related Articles
      </h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {related.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group flex items-start gap-3 p-4 bg-gray-50 rounded-xl hover:bg-orange-50 hover:border-orange-200 border border-transparent transition-all"
          >
            <div className="flex-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${
                post.category === 'Jumia'          ? 'bg-orange-100 text-orange-700' :
                post.category === 'Dropshipping'   ? 'bg-blue-100 text-blue-700'    :
                post.category === 'Getting Started'? 'bg-green-100 text-green-700'  :
                                                     'bg-purple-100 text-purple-700'
              }`}>{post.category}</span>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors leading-tight">
                {post.title}
              </p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />{post.readTime}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 mt-1 group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBySlug(slug) : undefined;

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <>
      <Helmet>
        <title>{post.title} — QAFRICA Blog</title>
        <meta name="description"  content={post.description} />
        <meta name="keywords"     content={post.keywords.join(', ')} />
        <link rel="canonical"     href={`https://qafrica.store/blog/${post.slug}`} />
        <meta property="og:title"       content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:type"        content="article" />
        <meta property="og:url"         content={`https://qafrica.store/blog/${post.slug}`} />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={post.title} />
        <meta name="twitter:description" content={post.description} />
        <script type="application/ld+json">{JSON.stringify({
          "@context":       "https://schema.org",
          "@type":          "BlogPosting",
          "headline":       post.title,
          "description":    post.description,
          "datePublished":  "2026-06-01",
          "dateModified":   "2026-06-01",
          "author":         { "@type": "Organization", "name": "QAFRICA" },
          "publisher":      { "@type": "Organization", "name": "QAFRICA", "url": "https://qafrica.store" },
          "keywords":       post.keywords.join(', '),
          "url":            `https://qafrica.store/blog/${post.slug}`,
          ...(post.slug === 'how-to-create-online-store-nigeria' && {
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "How do I start selling on Jumia, Konga or Jiji from my QAFRICA store?",
                "acceptedAnswer": { "@type": "Answer", "text": "Once your store is set up on QAFRICA, you can push your products to Jumia, Konga and Jiji with a single click from your dashboard." }},
              { "@type": "Question", "name": "What payment methods can my Nigerian customers use?",
                "acceptedAnswer": { "@type": "Answer", "text": "Every QAFRICA store comes with Paystack integrated — accepting cards, bank transfers, USSD and mobile money." }},
              { "@type": "Question", "name": "Do I need to buy stock upfront to start my store?",
                "acceptedAnswer": { "@type": "Answer", "text": "No. With QAFRICA's dropship model, you list products and only procure them when an order comes in." }},
            ],
          }),
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-white">

        {/* ── Top bar ── */}
        <div className="border-b border-gray-100 bg-white sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link
              to="/blog"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              All articles
            </Link>
            <a
              href={
                ['dropshipping-from-china-to-nigeria','import-products-from-china-nigeria'].includes(post.slug)
                  ? CTA_ROUTES.importations
                  : ['what-sells-best-on-jumia-2026','how-to-sell-on-jumia-without-getting-banned','sell-on-jumia-konga-jiji-nigeria'].includes(post.slug)
                  ? CTA_ROUTES.marketplaces
                  : CTA_ROUTES.signup
              }
              className="text-sm font-bold text-orange-600 hover:text-orange-700"
            >
              Get Started →
            </a>
          </div>
        </div>

        {/* ── Article ── */}
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Meta */}
            <div className="flex items-center gap-3 mb-6">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                post.category === 'Jumia'          ? 'bg-orange-100 text-orange-700' :
                post.category === 'Dropshipping'   ? 'bg-blue-100 text-blue-700'    :
                post.category === 'Getting Started'? 'bg-green-100 text-green-700'  :
                                                     'bg-purple-100 text-purple-700'
              }`}>
                <Tag className="w-3 h-3" />
                {post.category}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {post.readTime}
              </span>
              <span className="text-xs text-gray-400">{post.date}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-4 tracking-tight">
              {post.title}
            </h1>

            {/* Deck */}
            <p className="text-base text-gray-500 leading-relaxed mb-8 pb-8 border-b border-gray-100">
              {post.description}
            </p>

            {/* Content */}
            <PostContent slug={post.slug} />

            {/* Related */}
            <RelatedPosts slug={post.slug} category={post.category} />

            {/* Footer note */}
            <div className="mt-12 pt-6 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
              <p className="text-xs text-gray-400">
                Published by QAFRICA · {post.date}
              </p>
              <Link
                to="/blog"
                className="text-sm text-orange-600 font-semibold flex items-center gap-1 hover:text-orange-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to all articles
              </Link>
            </div>
          </motion.div>
        </article>
      </div>
    </>
  );
}
