// src/pages/blog/BlogIndexPage.tsx

import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Tag, ShoppingBag } from 'lucide-react';
import { posts, getFeatured } from './posts/index';

const CATEGORY_COLORS: Record<string, string> = {
  'Jumia':         'bg-orange-100 text-orange-700',
  'Dropshipping':  'bg-blue-100 text-blue-700',
  'Getting Started':'bg-green-100 text-green-700',
  'Strategy':      'bg-purple-100 text-purple-700',
};

function CategoryPill({ category }: { category: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
      CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-600'
    }`}>
      <Tag className="w-3 h-3" />
      {category}
    </span>
  );
}

function FeaturedCard({ post, index }: { post: typeof posts[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link
        to={`/blog/${post.slug}`}
        className="group block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-orange-200 transition-all duration-300"
      >
        {/* Illustration area */}
        <div className="h-48 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center relative overflow-hidden">
          <PostIllustration slug={post.slug} />
          <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent" />
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <CategoryPill category={post.category} />
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              {post.readTime}
            </span>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-2 leading-tight group-hover:text-orange-600 transition-colors">
            {post.title}
          </h2>

          <p className="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-2">
            {post.description}
          </p>

          <div className="flex items-center gap-1 text-sm font-semibold text-orange-600">
            Read article
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function RegularCard({ post, index }: { post: typeof posts[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.08 }}
    >
      <Link
        to={`/blog/${post.slug}`}
        className="group flex items-start gap-4 p-5 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all duration-300"
      >
        <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <SmallIllustration slug={post.slug} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <CategoryPill category={post.category} />
            <span className="text-xs text-gray-400">{post.readTime}</span>
          </div>
          <h3 className="text-sm font-bold text-gray-900 leading-tight group-hover:text-orange-600 transition-colors line-clamp-2">
            {post.title}
          </h3>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
      </Link>
    </motion.div>
  );
}

// ── SVG Illustrations per post ─────────────────────────────────────────────────

function PostIllustration({ slug }: { slug: string }) {
  if (slug === 'what-sells-best-on-jumia-2026') return (
    <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
      {/* Bar chart */}
      <rect x="20"  y="90" width="24" height="40" rx="4" fill="#fed7aa"/>
      <rect x="54"  y="60" width="24" height="70" rx="4" fill="#fb923c"/>
      <rect x="88"  y="40" width="24" height="90" rx="4" fill="#f97316"/>
      <rect x="122" y="55" width="24" height="75" rx="4" fill="#fb923c"/>
      <rect x="156" y="75" width="24" height="55" rx="4" fill="#fed7aa"/>
      {/* Trend line */}
      <polyline points="32,85 66,55 100,35 134,50 168,70" stroke="#ea6510" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="4 2"/>
      {/* Stars */}
      <circle cx="100" cy="20" r="6" fill="#fbbf24"/>
      <text x="97" y="24" fontSize="8" fill="white" fontWeight="800">★</text>
    </svg>
  );

  if (slug === 'how-to-sell-on-jumia-without-getting-banned') return (
    <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
      {/* Shield */}
      <path d="M90 15 L130 30 L130 75 C130 100 90 120 90 120 C90 120 50 100 50 75 L50 30 Z" fill="#dcfce7" stroke="#16a34a" strokeWidth="2"/>
      <path d="M90 25 L118 37 L118 72 C118 92 90 108 90 108 C90 108 62 92 62 72 L62 37 Z" fill="#bbf7d0"/>
      {/* Check */}
      <polyline points="76,70 86,80 106,58" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Two layer badges */}
      <rect x="18" y="95" width="52" height="22" rx="8" fill="#f97316"/>
      <text x="28" y="110" fontSize="8" fill="white" fontWeight="700">QC Layer 1</text>
      <rect x="110" y="95" width="52" height="22" rx="8" fill="#ea6510"/>
      <text x="120" y="110" fontSize="8" fill="white" fontWeight="700">QC Layer 2</text>
      {/* Arrows */}
      <line x1="70" y1="106" x2="110" y2="106" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 2"/>
      <polyline points="107,103 110,106 107,109" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

  if (slug === 'dropshipping-from-china-to-nigeria') return (
    <svg width="200" height="140" viewBox="0 0 200 140" fill="none">
      {/* China box */}
      <rect x="10" y="50" width="44" height="44" rx="8" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
      <text x="18" y="68" fontSize="7" fill="#1d4ed8" fontWeight="700">CHINA</text>
      <text x="22" y="82" fontSize="16">📦</text>
      {/* Arrow */}
      <line x1="54" y1="72" x2="78" y2="72" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 2"/>
      <polyline points="75,69 78,72 75,75" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
      {/* QAFRICA box */}
      <rect x="78" y="44" width="44" height="56" rx="8" fill="#fff7ed" stroke="#f97316" strokeWidth="1.5"/>
      <text x="84" y="62" fontSize="7" fill="#ea6510" fontWeight="700">QAFRICA</text>
      <text x="86" y="76" fontSize="8" fill="#6b7280">QC ✓✓</text>
      <text x="85" y="90" fontSize="8" fill="#6b7280">Store ✓</text>
      {/* Arrow */}
      <line x1="122" y1="72" x2="146" y2="72" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 2"/>
      <polyline points="143,69 146,72 143,75" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Platforms */}
      <rect x="146" y="30" width="44" height="18" rx="6" fill="#fff3e0" stroke="#e67e00" strokeWidth="1"/>
      <text x="154" y="42" fontSize="7.5" fill="#e67e00" fontWeight="800">JUMIA</text>
      <rect x="146" y="54" width="44" height="18" rx="6" fill="#fce4ec" stroke="#c2185b" strokeWidth="1"/>
      <text x="154" y="66" fontSize="7.5" fill="#c2185b" fontWeight="800">KONGA</text>
      <rect x="146" y="78" width="44" height="18" rx="6" fill="#e8f5e9" stroke="#2e7d32" strokeWidth="1"/>
      <text x="158" y="90" fontSize="7.5" fill="#2e7d32" fontWeight="800">JIJI</text>
      <rect x="146" y="102" width="44" height="18" rx="6" fill="#fff7ed" stroke="#f97316" strokeWidth="1"/>
      <text x="149" y="114" fontSize="6.5" fill="#f97316" fontWeight="800">YOUR STORE</text>
    </svg>
  );

  if (slug === 'how-to-create-online-store-nigeria') return (
    <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
      {/* Steps */}
      {[
        { x: 20,  y: 30, n: '01', label: 'Sign Up',   color: '#fed7aa', stroke: '#f97316' },
        { x: 65,  y: 30, n: '02', label: 'Pick Niche', color: '#fde68a', stroke: '#f59e0b' },
        { x: 110, y: 30, n: '03', label: 'Add Products',color: '#bbf7d0', stroke: '#16a34a' },
        { x: 155, y: 30, n: '04', label: 'Go Live',    color: '#dbeafe', stroke: '#3b82f6' },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={s.y} width="40" height="40" rx="10" fill={s.color} stroke={s.stroke} strokeWidth="1.5"/>
          <text x={s.x + 14} y={s.y + 18} fontSize="9" fill={s.stroke} fontWeight="800">{s.n}</text>
          <text x={s.x + 4}  y={s.y + 30} fontSize="6" fill="#4b5563" fontWeight="600">{s.label}</text>
          {i < 3 && <line x1={s.x + 40} y1={s.y + 20} x2={s.x + 65} y2={s.y + 20} stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="3 2"/>}
        </g>
      ))}
      {/* Store mockup */}
      <rect x="40" y="90" width="100" height="40" rx="10" fill="white" stroke="#f97316" strokeWidth="1.5"/>
      <rect x="40" y="90" width="100" height="14" rx="10" fill="#f97316"/>
      <text x="68" y="101" fontSize="7" fill="white" fontWeight="700">qafrica.store/you</text>
      <rect x="50" y="110" width="24" height="14" rx="4" fill="#fff7ed"/>
      <rect x="78" y="110" width="24" height="14" rx="4" fill="#fff7ed"/>
      <rect x="106" y="110" width="24" height="14" rx="4" fill="#fff7ed"/>
    </svg>
  );

  // best-niches
  return (
    <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
      {[
        { x: 20,  y: 20,  emoji: '👗', label: 'Fashion',     color: '#fce4ec', stroke: '#ec4899' },
        { x: 80,  y: 20,  emoji: '📱', label: 'Electronics', color: '#dbeafe', stroke: '#3b82f6' },
        { x: 140, y: 20,  emoji: '💄', label: 'Beauty',      color: '#f3e8ff', stroke: '#a855f7' },
        { x: 20,  y: 85,  emoji: '🏠', label: 'Home',        color: '#dcfce7', stroke: '#22c55e' },
        { x: 80,  y: 85,  emoji: '👟', label: 'Footwear',    color: '#fff7ed', stroke: '#f97316' },
        { x: 140, y: 85,  emoji: '🍱', label: 'Food',        color: '#fef9c3', stroke: '#eab308' },
      ].map((n, i) => (
        <g key={i}>
          <rect x={n.x} y={n.y} width="44" height="48" rx="10" fill={n.color} stroke={n.stroke} strokeWidth="1.2"/>
          <text x={n.x + 12} y={n.y + 24} fontSize="16">{n.emoji}</text>
          <text x={n.x + 4}  y={n.y + 40} fontSize="6.5" fill="#374151" fontWeight="600">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

function SmallIllustration({ slug }: { slug: string }) {
  const icons: Record<string, string> = {
    'what-sells-best-on-jumia-2026':             '📊',
    'how-to-sell-on-jumia-without-getting-banned':'🛡️',
    'dropshipping-from-china-to-nigeria':         '🚚',
    'how-to-create-online-store-nigeria':         '🏪',
    'best-niches-nigeria-2026':                   '🎯',
  };
  return <span style={{ fontSize: 24 }}>{icons[slug] || '📝'}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BlogIndexPage() {
  const featured = getFeatured();
  const regular  = posts.filter(p => !p.featured);

  return (
    <>
      <Helmet>
        <title>QAFRICA Blog — Sell Online in Nigeria, Jumia Tips & Dropshipping Guides</title>
        <meta name="description" content="Practical guides for Nigerian sellers — what sells on Jumia, how to dropship from China, and how to grow your online store. Updated monthly." />
        <meta name="keywords" content="sell online nigeria, jumia seller guide, dropshipping nigeria, online store nigeria, konga seller, jiji nigeria" />
        <link rel="canonical" href="https://qafrica.store/blog" />
      </Helmet>

      <div className="min-h-screen bg-gray-50">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-full px-4 py-1.5 mb-6">
                <ShoppingBag className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                  QAFRICA Resources
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
                Grow Your Nigerian Business
              </h1>
              <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed">
                Practical guides on selling online, dropshipping from China,
                and listing on Jumia, Konga and Jiji — all from one place.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">

          {/* ── Featured posts ── */}
          <div className="mb-10">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">
              Featured Guides
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {featured.map((post, i) => (
                <FeaturedCard key={post.slug} post={post} index={i} />
              ))}
            </div>
          </div>

          {/* ── More articles ── */}
          {regular.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">
                More Articles
              </h2>
              <div className="flex flex-col gap-3">
                {regular.map((post, i) => (
                  <RegularCard key={post.slug} post={post} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* ── Bottom CTA ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-white text-center"
          >
            <ShoppingBag className="w-10 h-10 mx-auto mb-4 opacity-90" />
            <h3 className="text-xl font-bold mb-2">
              Ready to start selling?
            </h3>
            <p className="text-orange-100 text-sm mb-6 max-w-md mx-auto">
              Source from China, list on Jumia, Konga and Jiji — all from one dashboard.
              We handle warehousing, QC and fulfilment.
            </p>
            <a
              href="/signup"
              className="inline-flex items-center gap-2 bg-white text-orange-600 font-bold px-6 py-3 rounded-xl hover:bg-orange-50 transition-colors"
            >
              Start Free — No Credit Card
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>

        </div>
      </div>
    </>
  );
}