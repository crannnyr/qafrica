// src/pages/blog/BlogPostPage.tsx

import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Clock, Tag, ArrowRight,
  ShoppingBag, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { getBySlug, getRelated } from './posts/index';

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

function CtaBanner({ headline, sub }: { headline: string; sub: string }) {
  return (
    <div className="my-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-7 text-white">
      <ShoppingBag className="w-8 h-8 mb-3 opacity-90" />
      <h3 className="text-lg font-bold mb-2">{headline}</h3>
      <p className="text-orange-100 text-sm mb-5 leading-relaxed">{sub}</p>
      <a
        href="/signup"
        className="inline-flex items-center gap-2 bg-white text-orange-600 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-orange-50 transition-colors"
      >
        Start Free — No Credit Card
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

// ── Supply chain diagram ───────────────────────────────────────────────────────

function SupplyChainDiagram() {
  return (
    <div className="my-8 bg-gray-50 rounded-2xl p-6 overflow-x-auto">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 text-center">
        How QAFRICA Works
      </p>
      <div className="flex items-center justify-center gap-2 min-w-max mx-auto">
        {[
          { label: 'China\nSupplier', color: 'bg-blue-100 text-blue-700 border-blue-200',   emoji: '🏭' },
          { label: 'QAFRICA\nQC Check 1', color: 'bg-orange-100 text-orange-700 border-orange-200', emoji: '🔍' },
          { label: 'QAFRICA\nQC Check 2', color: 'bg-orange-200 text-orange-800 border-orange-300', emoji: '✅' },
          { label: 'Jumia\nKonga · Jiji', color: 'bg-green-100 text-green-700 border-green-200',   emoji: '🛒' },
          { label: 'Your\nStore',   color: 'bg-purple-100 text-purple-700 border-purple-200', emoji: '🏪' },
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
    { rank: 8,  name: 'Men\'s Clothing',            margin: '40–60%', demand: '📈 Growing'   },
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

  if (slug === 'what-sells-best-on-jumia-2026') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Jumia processed over <strong>3 million orders</strong> in Nigeria last quarter alone.
        But not every product sells equally. We analysed the top performing categories
        so you know exactly where to focus your energy — and your money.
      </p>

      <PullQuote>
        The best-selling products on Jumia share one thing: they solve an everyday
        Nigerian problem at an affordable price point.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Top 10 Best-Selling Products on Jumia Nigeria (2026)
      </h2>

      <TopProductsTable />

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Why These Products Win
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Each of these categories shares three traits that make them Jumia bestsellers:
        high search volume, repeat purchase potential, and wide demographic appeal.
        Phone accessories, for example, are purchased by virtually every smartphone
        owner — and Nigeria has over 100 million smartphone users.
      </p>

      <InfoBox
        title="What makes a Jumia bestseller?"
        items={[
          'Lightweight and easy to ship — reduces return rates',
          'Under ₦15,000 — Nigerian impulse buy threshold',
          'Solves an everyday problem most buyers already know they have',
          'Photographable — looks great on a product listing',
          'Low return rate — means Jumia favours your account',
        ]}
      />

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        How to Sell These Without Holding Inventory
      </h2>
      <p className="text-gray-600 leading-relaxed mb-6">
        Here is where most new sellers get stuck — they see the opportunity but
        don't have capital to buy stock, or space to store it. QAFRICA solves
        exactly this. We source directly from verified Chinese manufacturers,
        warehouse in Nigeria, pass products through two quality control checks,
        then list on Jumia on your behalf.
      </p>

      <SupplyChainDiagram />

      <p className="text-gray-600 leading-relaxed mb-4">
        You set your selling price. We handle everything else. When an order comes in,
        we pick, pack and ship it. The margin is yours.
      </p>

      <CtaBanner
        headline="Start selling Jumia's best products today"
        sub="No inventory. No warehouse. No shipping headaches. QAFRICA sources, QCs and lists for you — you just collect your margin."
      />
    </div>
  );

  if (slug === 'how-to-sell-on-jumia-without-getting-banned') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Jumia suspends or permanently bans thousands of seller accounts every month.
        The most common reason isn't fraud — it's <strong>quality violations</strong>.
        A single batch of substandard products can end your entire selling career on the platform.
      </p>

      <WarningBox>
        Jumia's seller policy states that three quality-related complaints within 30 days
        can trigger an automatic account review. Five complaints can result in permanent suspension
        with no appeal process.
      </WarningBox>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Why Sellers Get Banned
      </h2>

      <InfoBox
        title="Most common reasons for Jumia seller bans"
        items={[
          'Products don\'t match listing description or photos',
          'Items arrive damaged due to poor packaging',
          'Counterfeit or "grade B" products passed off as original',
          'Missing accessories or incomplete sets',
          'Late fulfilment — Jumia penalises slow shipping heavily',
        ]}
      />

      <PullQuote>
        Most bans happen not because sellers are dishonest — but because they
        trusted unverified suppliers without checking quality first.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        The 2-Layer QC System That Protects You
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        At QAFRICA, every product goes through two independent quality checks before
        it ever touches a Jumia listing. This is not optional — it's built into our
        fulfilment process.
      </p>

      <SupplyChainDiagram />

      <div className="my-6 space-y-4">
        <StepCard
          number="1"
          title="QC Check One — At Source"
          description="When goods arrive from our Chinese suppliers, every batch is inspected at our receiving warehouse. We check quantity, packaging integrity, product condition and match against the original specification sheet."
        />
        <StepCard
          number="2"
          title="QC Check Two — Before Listing"
          description="A second team reviews a sample of each batch before the product is listed. They verify product photos match the actual item, measure dimensions, test functionality where applicable, and confirm packaging meets Jumia's standards."
        />
        <StepCard
          number="3"
          title="Listing Review — Accuracy Check"
          description="Our listing team writes product descriptions that are accurate, detailed and Jumia-compliant. Misleading listings are the single fastest way to get banned — we make sure yours never are."
        />
      </div>

      <InfoBox
        title="What QAFRICA's QC protects you from"
        items={[
          'Receiving damaged or wrong products from Chinese suppliers',
          'Accidentally listing items that violate Jumia\'s category rules',
          'Poor packaging that leads to in-transit damage and returns',
          'Photo mismatches that trigger buyer complaints',
          'Account health score drops from avoidable quality issues',
        ]}
      />

      <CtaBanner
        headline="Sell on Jumia safely — we handle compliance"
        sub="Our 2-layer QC system has maintained a sub-1% complaint rate across all QAFRICA-listed products on Jumia. Your account stays healthy."
      />
    </div>
  );

  if (slug === 'dropshipping-from-china-to-nigeria') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        China manufactures the majority of consumer products sold in Nigeria today.
        The difference between sellers who profit and those who struggle is simple:
        <strong> proximity to the source</strong>. QAFRICA gives every Nigerian seller
        direct access to verified Chinese manufacturers — with none of the usual risk.
      </p>

      <PullQuote>
        You don't need to travel to China, speak Mandarin or wire money to a stranger
        on Alibaba. QAFRICA handles the entire import chain for you.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        How the QAFRICA China-to-Nigeria Pipeline Works
      </h2>

      <SupplyChainDiagram />

      <div className="my-6 space-y-4">
        <StepCard
          number="1"
          title="Browse Our Import Catalog"
          description="QAFRICA's catalog contains thousands of products sourced directly from verified Chinese manufacturers. Every item has been pre-vetted for quality, demand and margin potential in the Nigerian market."
        />
        <StepCard
          number="2"
          title="Select Products to Sell"
          description="Pick the products you want to sell. Set your own price and margin. You don't pay for anything until an order comes in — no upfront inventory cost."
        />
        <StepCard
          number="3"
          title="We Source, QC and Warehouse"
          description="QAFRICA orders from the supplier, receives the goods at our Nigerian warehouse, runs two quality checks, and stores the inventory ready for orders."
        />
        <StepCard
          number="4"
          title="We List on Jumia, Konga and Jiji"
          description="Your products appear on all three major Nigerian marketplaces simultaneously, plus your own QAFRICA storefront. One upload, four channels."
        />
        <StepCard
          number="5"
          title="Orders Come In — We Ship"
          description="When a customer orders, we pick, pack and dispatch. The tracking number goes to the customer. Your margin hits your QAFRICA wallet."
        />
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
        Not all products from China are equal. Our QC team rejects roughly 12% of
        incoming batches that don't meet our standards. This protects your Jumia
        account health — and your customers.
      </WarningBox>

      <CtaBanner
        headline="Start dropshipping from China today"
        sub="Browse our catalog, pick your products and set your price. We source, warehouse, QC and ship. You collect the margin."
      />
    </div>
  );

  if (slug === 'how-to-create-online-store-nigeria') return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Creating an online store in Nigeria used to mean hiring a developer,
        waiting weeks and spending hundreds of thousands of naira. In 2026,
        you can go from zero to a live, selling store in under 10 minutes —
        no code, no designer, no technical knowledge required.
      </p>

      <PullQuote>
        The fastest-growing Nigerian online businesses were started by people
        with no tech background. The barrier is lower than you think.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Step-by-Step: Create Your Nigerian Online Store
      </h2>

      <div className="my-6 space-y-4">
        <StepCard
          number="1"
          title="Sign Up on QAFRICA"
          description="Create your account with just an email address. No credit card needed. Your 4-day free trial starts immediately — full access to all features."
        />
        <StepCard
          number="2"
          title="Choose Your Niche"
          description="Pick the category that matches your products. QAFRICA has tailored themes, catalogs and features for each niche — from fashion to electronics to beauty."
        />
        <StepCard
          number="3"
          title="Name Your Store and Set Your URL"
          description="Your store gets a free qafrica.store/yourname URL instantly. On paid plans you can connect a custom domain like yourstore.com."
        />
        <StepCard
          number="4"
          title="Add Products"
          description="Upload your own products or browse QAFRICA's import catalog and add products with one click. Descriptions, photos and pricing are handled for catalog products."
        />
        <StepCard
          number="5"
          title="Choose a Theme"
          description="Pick from professionally designed themes built for your niche. Customise colours, fonts and layout — no design skills needed."
        />
        <StepCard
          number="6"
          title="Go Live and Start Selling"
          description="Hit publish. Your store is live instantly at your QAFRICA URL. Share it, run ads, or let QAFRICA push your products to Jumia, Konga and Jiji automatically."
        />
      </div>

      <InfoBox
        title="What's included on every QAFRICA store"
        items={[
          'Free qafrica.store subdomain (custom domain on paid plans)',
          'Secure Paystack and bank transfer payment processing',
          '7-day escrow protection on every order',
          'Mobile-optimised storefront — looks great on any device',
          'Order management and tracking dashboard',
          'Real-time sales and traffic analytics',
        ]}
      />

      <CtaBanner
        headline="Launch your Nigerian online store in 10 minutes"
        sub="Free to start. No credit card. No technical skills needed. Your store could be live before you finish your next cup of tea."
      />
    </div>
  );

  // best-niches-nigeria-2026
  return (
    <div className="prose-content">
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Choosing the right niche is the single most important decision you'll make
        as an online seller in Nigeria. Pick wrong and you'll fight for every sale.
        Pick right and the market comes to you. Here are the 10 most profitable
        niches in Nigeria right now — backed by real transaction data.
      </p>

      <PullQuote>
        The most profitable niche is not necessarily the most popular one —
        it's the one where demand exceeds supply and margins stay healthy.
      </PullQuote>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">
        Top 10 Niches to Sell Online in Nigeria (2026)
      </h2>

      <div className="my-6 space-y-3">
        {[
          { rank: '01', niche: 'Hair & Beauty',        why: 'Repeat purchase. Nigerian women spend more on hair than any other category. Consistent monthly revenue.' },
          { rank: '02', niche: 'Phone Accessories',    why: 'Nigeria has 100M+ smartphone users. Every new phone means new accessories. Near-zero return rate.' },
          { rank: '03', niche: 'Fashion & Clothing',   why: 'Largest category by volume on every Nigerian marketplace. Huge catalog, many untapped micro-niches.' },
          { rank: '04', niche: 'Skincare & Cosmetics', why: 'Premium margins. Nigerian consumers increasingly brand-conscious. Strong Jumia and Konga performance.' },
          { rank: '05', niche: 'Baby & Kids',          why: 'Parents are the most reliable spenders. Low price sensitivity. Strong repeat purchase rate.' },
          { rank: '06', niche: 'Kitchen Appliances',   why: 'Air fryers, blenders and organisers are booming. Middle-class growth driving demand.' },
          { rank: '07', niche: 'Footwear',             why: 'Sneaker culture is huge in Nigeria. Good margins on imported styles. Strong social media demand.' },
          { rank: '08', niche: 'Home & Living',        why: 'Growing with urbanisation. Décor, storage and organisation products selling fast.' },
          { rank: '09', niche: 'Fitness & Wellness',   why: 'Post-pandemic health awareness boom. Resistance bands, supplements, equipment all growing.' },
          { rank: '10', niche: 'Electronics & Gadgets',why: 'High ticket value means fewer sales needed. Bluetooth, smart home and gaming accessories lead.' },
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
        title="How to validate your niche before starting"
        items={[
          'Search the category on Jumia — count how many sellers exist and their review counts',
          'Check Google Trends Nigeria for the past 12 months — is interest stable or growing?',
          'Look at the top 3 sellers — can you source the same products cheaper via QAFRICA?',
          'Calculate your margin — aim for at least 40% after platform fees and shipping',
          'Start with 5–10 products, not 100 — focus beats breadth for new stores',
        ]}
      />

      <CtaBanner
        headline="Pick your niche and launch today"
        sub="QAFRICA has tailored themes, catalogs and supplier connections for every niche on this list. Start your free trial and be selling within the hour."
      />
    </div>
  );
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
            <Link to="/signup" className="text-sm font-bold text-orange-600 hover:text-orange-700">
              Start Free →
            </Link>
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