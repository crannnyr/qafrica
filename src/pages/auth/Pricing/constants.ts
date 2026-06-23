// src/pages/auth/Pricing/constants.ts

import { Star, Zap, Crown, Infinity as InfinityIcon } from 'lucide-react';
import CONFIG from '@/lib/config';

export const durations = [
  { value: 1,  label: '1 Month',  multiplier: 1,   discount: '0%'  },
  { value: 3,  label: '3 Months', multiplier: 2.7, discount: '10%' },
  { value: 6,  label: '6 Months', multiplier: 5,   discount: '17%' },
  { value: 12, label: '1 Year',   multiplier: 9,   discount: '25%' },
];

// ── Shared feature list — identical across ALL plans ──────────────────────────
// Only niches and staff differ — those are added per-plan below
const SHARED_FEATURES = [
  'Unlimited Products',
  'Full Analytics Suite',
  'All Store Themes',
  'Custom Domain',
  'Import Catalog',
  'Dropshipping',
  'Delivery Zones',
  'Coupons & Discounts',
  'Order Management',
  'Wallet & Payouts',
  'Reviews System',
  'Tax & Expense Reports',
  'Manual Sales Entry',
  'API Access',
  'Priority Support',
  'Push to Jumia, Konga & Jiji',
] as const;

export const monthlyPlans = [
  {
    id:          'one_niche',
    name:        'Starter',
    icon:        Star,
    description: 'Perfect for focused sellers',
    basePrice:   CONFIG.PRICING?.SINGLE_NICHE || 5000,
    maxNiches:   1,
    staffLimit:  0,
    features:    [...SHARED_FEATURES],
    cta:         'Get Started',
    popular:     false,
  },
  {
    id:          'three_niches',
    name:        'Growth',
    icon:        Zap,
    description: 'For expanding businesses',
    basePrice:   CONFIG.PRICING?.THREE_NICHES || 10000,
    maxNiches:   3,
    staffLimit:  3,
    features:    [...SHARED_FEATURES],
    cta:         'Get Started',
    popular:     true,
  },
  {
    id:          'unlimited',
    name:        'Enterprise',
    icon:        Crown,
    description: 'For established brands',
    basePrice:   CONFIG.PRICING?.UNLIMITED || 100000,
    maxNiches:   Number.POSITIVE_INFINITY,
    staffLimit:  10,
    features:    [...SHARED_FEATURES],
    cta:         'Get Started',
    popular:     false,
  },
] as const;

export const lifetimePlans = [
  {
    id:          'one_niche',
    name:        'Starter Lifetime',
    icon:        Star,
    description: 'One-time payment, lifetime access',
    price:       2000000,
    maxNiches:   1,
    staffLimit:  0,
    features:    [...SHARED_FEATURES],
    cta:         'Buy Lifetime',
    popular:     false,
    badge:       'Save 90%+',
  },
  {
    id:          'three_niches',
    name:        'Growth Lifetime',
    icon:        Zap,
    description: 'Best value for serious sellers',
    price:       3800000,
    maxNiches:   3,
    staffLimit:  3,
    features:    [...SHARED_FEATURES],
    cta:         'Buy Lifetime',
    popular:     true,
    badge:       'Best Value',
  },
  {
    id:          'unlimited',
    name:        'Enterprise Lifetime',
    icon:        InfinityIcon,
    description: 'Ultimate power for big brands',
    price:       10000000,
    maxNiches:   Number.POSITIVE_INFINITY,
    staffLimit:  10,
    features:    [...SHARED_FEATURES],
    cta:         'Buy Lifetime',
    popular:     false,
    badge:       'Ultimate',
  },
] as const;

// ── Subscription tier limits (used across the app) ────────────────────────────
export const SUBSCRIPTION_NICHE_LIMITS: Record<string, number> = {
  free:          1,
  one_niche:     1,
  three_niches:  3,
  unlimited:     Infinity,
};

export const SUBSCRIPTION_STAFF_LIMITS: Record<string, number> = {
  free:          0,
  one_niche:     0,
  three_niches:  3,
  unlimited:     10,
};
