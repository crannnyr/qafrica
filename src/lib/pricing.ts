// QuickSell Africa - Niche-Based Subscription Pricing Configuration

export interface PricingTier {
  id: string; // 'one_niche' | 'three_niches' | 'unlimited'
  name: string;
  description: string;
  basePrice: number; // Monthly price in Naira
  nichesAllowed: number | typeof Infinity;
  features: string[];
  notIncluded: string[];
  popular?: boolean;
}

export interface DurationPlan {
  months: number;
  discount: number; // Percentage discount
  label: string;
}

export interface SubscriptionPlan {
  tier: PricingTier;
  duration: DurationPlan;
  totalPrice: number;
  discountedPrice: number;
  savings: number;
}

// Trial Configuration
export const TRIAL_CONFIG = {
  durationDays: 4,
  reminderDay: 3,
  tier: 'one_niche' as const,
  features: [
    '1 Niche selection',
    'Unlimited products',
    'Basic analytics',
    'Standard support',
    'Custom store URL',
    'Mobile-friendly store'
  ]
};

// Helper functions
export const isTrialExpired = (expiresAt: string): boolean => {
  return new Date() > new Date(expiresAt);
};

export const getTrialDaysRemaining = (expiresAt: string): number => {
  const diff = new Date(expiresAt).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Updated Pricing Tiers - Niche Based
export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'one_niche',
    name: 'One Niche',
    description: 'Perfect for beginners focusing on one category',
    basePrice: 5000,
    nichesAllowed: 1,
    features: [
      '1 niche selection',
      'Unlimited products in your niche',
      'Basic analytics',
      'Standard support',
      'Custom store URL',
      'Mobile-friendly store',
      'Product import from same niche'
    ],
    notIncluded: [
      'Multiple niches',
      'Priority support',
      'Advanced analytics'
    ]
  },
  {
    id: 'three_niches',
    name: 'Three Niches',
    description: 'Ideal for growing businesses with multiple categories',
    basePrice: 10000,
    nichesAllowed: 3,
    features: [
      '3 niche selections',
      'Unlimited products across niches',
      'Advanced analytics',
      'Priority support',
      'Custom store URL',
      'Mobile-friendly store',
      'Cross-niche product import',
      'Coupon system',
      'Bulk import tools'
    ],
    notIncluded: [
      'Unlimited niches'
    ],
    popular: true
  },
  {
    id: 'unlimited',
    name: 'Unlimited Niches',
    description: 'For established sellers who want to sell everything',
    basePrice: 100000,
    nichesAllowed: Infinity,
    features: [
      'Unlimited niches',
      'Unlimited products',
      'Premium analytics',
      'VIP support',
      'Custom store URL',
      'Mobile-friendly store',
      'All product import features',
      'Coupon system',
      'Priority withdrawals',
      'Dedicated account manager',
      'API access'
    ],
    notIncluded: []
  }
];

// Duration plans
export const DURATION_PLANS: DurationPlan[] = [
  { months: 1, discount: 0, label: '1 Month' },
  { months: 3, discount: 0, label: '3 Months' },
  { months: 6, discount: 5, label: '6 Months (5% off)' },
  { months: 12, discount: 10, label: '1 Year (10% off)' }
];

// Lifetime pricing
export const LIFETIME_PRICING: Record<string, number> = {
  'one_niche': 2000000,
  'three_niches': 3800000,
  'unlimited': 8000000
};

// Calculate subscription price
export const calculateSubscriptionPrice = (
  tierId: string,
  durationMonths: number
): { originalPrice: number; discountedPrice: number; savings: number; discountPercent: number } => {
  const tier = PRICING_TIERS.find(t => t.id === tierId);
  if (!tier) {
    return { originalPrice: 0, discountedPrice: 0, savings: 0, discountPercent: 0 };
  }

  const durationPlan = DURATION_PLANS.find(d => d.months === durationMonths);
  const discountPercent = durationPlan?.discount || 0;

  const originalPrice = tier.basePrice * durationMonths;
  const discountAmount = (originalPrice * discountPercent) / 100;
  const discountedPrice = originalPrice - discountAmount;
  const savings = discountAmount;

  return {
    originalPrice,
    discountedPrice,
    savings,
    discountPercent
  };
};

export const getLifetimePrice = (tierId: string): number => {
  return LIFETIME_PRICING[tierId] || 0;
};

export const formatPrice = (price: number): string => {
  return `₦${price.toLocaleString()}`;
};

export const getTierById = (tierId: string): PricingTier | null => {
  return PRICING_TIERS.find(t => t.id === tierId) || null;
};

// Check if user can add another niche based on their tier
export const canAddNiche = (currentTierId: string, currentNicheCount: number): boolean => {
  const tier = getTierById(currentTierId);
  if (!tier) return false;
  
  if (tier.nichesAllowed === Infinity) return true;
  return currentNicheCount < tier.nichesAllowed;
};

// Get how many more niches user can add
export const getRemainingNiches = (currentTierId: string, currentNicheCount: number): number => {
  const tier = getTierById(currentTierId);
  if (!tier) return 0;
  
  if (tier.nichesAllowed === Infinity) return Infinity;
  return Math.max(0, tier.nichesAllowed - currentNicheCount);
};

export const canUpgradeTier = (currentTierId: string, newTierId: string): boolean => {
  const tierOrder = ['one_niche', 'three_niches', 'unlimited'];
  const currentIndex = tierOrder.indexOf(currentTierId);
  const newIndex = tierOrder.indexOf(newTierId);
  
  return newIndex > currentIndex;
};

export const canDowngradeTier = (currentTierId: string, newTierId: string): boolean => {
  const tierOrder = ['one_niche', 'three_niches', 'unlimited'];
  const currentIndex = tierOrder.indexOf(currentTierId);
  const newIndex = tierOrder.indexOf(newTierId);
  
  return newIndex < currentIndex;
};

export const getTierChangeInfo = (
  currentTierId: string,
  newTierId: string,
  currentNicheCount: number = 0
): { 
  type: 'upgrade' | 'downgrade' | 'same';
  allowed: boolean;
  message: string;
  nichesToRemove?: number;
} => {
  if (currentTierId === newTierId) {
    return { type: 'same', allowed: false, message: 'You are already on this plan' };
  }

  const currentTier = getTierById(currentTierId);
  const newTier = getTierById(newTierId);

  if (!currentTier || !newTier) {
    return { type: 'same', allowed: false, message: 'Invalid tier selection' };
  }

  if (canUpgradeTier(currentTierId, newTierId)) {
    return {
      type: 'upgrade',
      allowed: true,
      message: `Upgrade to ${newTier.name} and unlock ${newTier.nichesAllowed === Infinity ? 'unlimited' : newTier.nichesAllowed} niches!`
    };
  }

  // Downgrade - check if niches need to be removed
  const newTierLimit = newTier.nichesAllowed === Infinity ? Infinity : newTier.nichesAllowed;
  const nichesToRemove = newTierLimit === Infinity ? 0 : Math.max(0, currentNicheCount - newTierLimit);
  
  return {
    type: 'downgrade',
    allowed: true,
    message: nichesToRemove > 0 
      ? `Downgrade to ${newTier.name}. You must remove ${nichesToRemove} niche(s) first.`
      : `Downgrade to ${newTier.name}.`,
    nichesToRemove: nichesToRemove > 0 ? nichesToRemove : undefined
  };
};

export const getAllPlans = (): SubscriptionPlan[] => {
  const plans: SubscriptionPlan[] = [];

  PRICING_TIERS.forEach(tier => {
    DURATION_PLANS.forEach(duration => {
      const { originalPrice, discountedPrice, savings } = calculateSubscriptionPrice(
        tier.id,
        duration.months
      );

      plans.push({
        tier,
        duration,
        totalPrice: originalPrice,
        discountedPrice,
        savings
      });
    });
  });

  return plans;
};

export const getRecommendedPlan = (): SubscriptionPlan => {
  const tier = PRICING_TIERS.find(t => t.id === 'three_niches')!;
  const duration = DURATION_PLANS.find(d => d.months === 3)!;
  const { originalPrice, discountedPrice, savings } = calculateSubscriptionPrice('three_niches', 3);

  return {
    tier,
    duration,
    totalPrice: originalPrice,
    discountedPrice,
    savings
  };
};

export const getTrialPlan = (): SubscriptionPlan => {
  const tier = PRICING_TIERS.find(t => t.id === TRIAL_CONFIG.tier)!;
  return {
    tier,
    duration: { months: 0, discount: 0, label: '4-Day Trial' },
    totalPrice: 0,
    discountedPrice: 0,
    savings: tier.basePrice
  };
};