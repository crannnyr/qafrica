// src/pages/landing/Landing/constants.ts

import {
  Store, Package, TrendingUp, Shield, Zap, Globe,
  Truck, Lock, Headphones,
} from 'lucide-react';
import CONFIG from '@/lib/config';

// ── Features ──────────────────────────────────────────────────────────────────

export const features = [
  { icon: Store,      title: 'Beautiful Store Themes',   description: 'Choose from professionally designed themes tailored for your niche. Fully customizable to match your brand.' },
  { icon: Package,    title: 'Product Import Catalog',   description: 'Import products from our curated catalog and expand your inventory instantly — no sourcing needed.' },
  { icon: TrendingUp, title: 'Powerful Analytics',       description: 'Track sales, monitor traffic, and understand your customers with real-time data and visual reports.' },
  { icon: Shield,     title: 'Secure Escrow Payments',   description: '7-day escrow protection ensures safe transactions. Sellers get paid, buyers get what they ordered.' },
  { icon: Zap,        title: 'Lightning Fast Setup',     description: 'Go from zero to a live store in under 10 minutes. No coding, no design skills needed.' },
  { icon: Globe,      title: 'Built for Nigeria',        description: 'Naira pricing, local delivery integrations, and Nigerian payment methods — all out of the box.' },
  { icon: Truck,      title: 'Delivery Zone Management', description: 'Set custom delivery zones and pricing per region. Serve your city or the whole country.' },
  { icon: Lock,       title: 'Custom Domain Support',    description: 'Connect your own domain and make your store truly yours with a professional web address.' },
  { icon: Headphones, title: 'Dedicated Support',        description: "Our team is based in Nigeria and understands local business challenges. We've got your back." },
];

// ── Niches ────────────────────────────────────────────────────────────────────

export const niches = CONFIG.NICHES.slice(0, 8);

// ── Testimonials ──────────────────────────────────────────────────────────────

export const testimonials = [
  {
    name:    'Chioma Adeyemi',
    role:    'Fashion Store Owner, Lagos',
    content: 'QAFRICA turned my boutique into a full online business. The import catalog alone saves me hours every week.',
    rating:  5,
  },
  {
    name:    'Emmanuel Okafor',
    role:    'Electronics Seller, Abuja',
    content: 'The analytics dashboard showed me exactly which products were selling and when. My revenue tripled in 3 months.',
    rating:  5,
  },
  {
    name:    'Amina Ibrahim',
    role:    'Jewelry Designer, Kano',
    content: 'The escrow system gives my customers confidence to buy. Returns and disputes are handled fairly and quickly.',
    rating:  5,
  },
];

// ── Stats ─────────────────────────────────────────────────────────────────────

export const stats = [
  { value: '10,000+', label: 'Active Stores'           },
  { value: '₦500M+',  label: 'Transactions Processed'  },
  { value: '50,000+', label: 'Products Listed'          },
  { value: '99.9%',   label: 'Uptime'                   },
];

// ── Pricing ───────────────────────────────────────────────────────────────────

export const pricingTiers = [
  {
    name:        'Starter',
    price:       '5,000',
    period:      '/month',
    description: 'Perfect for new sellers',
    popular:     false,
    cta:         'Start Free Trial',
    features: [
      '1 Niche Selection',
      'Unlimited Products',
      'Basic Analytics',
      'Standard Themes',
      'Email Support',
      'Escrow Payments',
    ],
  },
  {
    name:        'Growth',
    price:       '10,000',
    period:      '/month',
    description: 'For expanding businesses',
    popular:     true,
    cta:         'Start Free Trial',
    features: [
      '3 Niche Selections',
      'Unlimited Products',
      'Advanced Analytics',
      'Premium Themes',
      'Priority Support',
      'Import Catalog Access',
      'Custom Domain',
    ],
  },
  {
    name:        'Enterprise',
    price:       '100,000',
    period:      '/month',
    description: 'For established brands',
    popular:     false,
    cta:         'Contact Sales',
    features: [
      'Unlimited Niches',
      'Unlimited Products',
      'Full Analytics Suite',
      'All Themes + Custom',
      '24/7 Priority Support',
      'Import Catalog + Dropship',
      'Dedicated Account Manager',
      'White-label Options',
    ],
  },
];

// ── FAQs ──────────────────────────────────────────────────────────────────────

export const faqs = [
  {
    q: 'Do I need technical skills to use QAFRICA?',
    a: 'None at all. QAFRICA is built for entrepreneurs, not developers. Our store builder is fully drag-and-drop and you can go live in minutes.',
  },
  {
    q: 'How does the escrow payment system work?',
    a: "When a customer places an order, payment is held securely for 7 days. Once the customer confirms delivery, funds are released to your wallet. This protects both buyers and sellers.",
  },
  {
    q: 'Can I use my own domain name?',
    a: 'Yes. On Growth and Enterprise plans, you can connect a custom domain (e.g. yourstore.com) to make your store fully branded.',
  },
  {
    q: 'What payment methods do Nigerian customers support?',
    a: 'We support all major Nigerian payment methods including bank transfer, Paystack, and card payments — fully integrated.',
  },
  {
    q: 'Is there a free trial?',
    a: "Yes. You can start a free trial on any plan with no credit card required. You only pay when you're ready to go live.",
  },
];

// ── Marketplace cycle (Sell on Jumia button) ──────────────────────────────────

export const MARKETPLACES = [
  { label: 'Sell on Jumia', color: '#e67e00', bg: '#fff3e0', border: '#ffe0b2' },
  { label: 'Sell on Konga', color: '#c2185b', bg: '#fce4ec', border: '#f8bbd0' },
  { label: 'Sell on Jiji',  color: '#2e7d32', bg: '#e8f5e9', border: '#c8e6c9' },
] as const;

// ── Blog posts for footer ─────────────────────────────────────────────────────

export const blogLinks = [
  { label: 'What sells best on Jumia',        slug: 'what-sells-best-on-jumia-2026'             },
  { label: 'Sell on Jumia without getting banned', slug: 'how-to-sell-on-jumia-without-getting-banned' },
  { label: 'Dropshipping from China guide',   slug: 'dropshipping-from-china-to-nigeria'         },
  { label: 'Create an online store Nigeria',  slug: 'how-to-create-online-store-nigeria'          },
  { label: 'Best niches Nigeria 2026',        slug: 'best-niches-nigeria-2026'                   },
];

// ── Easing ────────────────────────────────────────────────────────────────────

export const ease = {
  outExpo: [0.16, 1, 0.3, 1]          as const,
  inExpo:  [0.7,  0, 0.84, 0]         as const,
  inOut:   [0.45, 0, 0.55, 1]         as const,
  bounce:  [0.34, 1.6, 0.64, 1]       as const,
  elastic: [0.68, -0.55, 0.265, 1.55] as const,
};