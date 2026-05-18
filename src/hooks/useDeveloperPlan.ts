// src/hooks/useDeveloperPlan.ts
// Derives plan-specific permissions, limits, and expiry state from the
// developer record in the auth store.
//
// Usage:
//   const { can, limits, expiry, planLabel } = useDeveloperPlan();
//   if (!can.createOrders) return <PlanGateMessage required="starter" />;

import { useMemo } from 'react';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import type { DeveloperPlan } from '@/types/developer';

// ── Permission matrix — mirrors edge function logic exactly ───
const PERMISSIONS: Record<DeveloperPlan, string[]> = {
  free:       ['read_products', 'read_delivery'],
  starter:    ['read_products', 'read_delivery', 'create_imports', 'create_orders', 'manage_webhooks'],
  growth:     ['read_products', 'read_delivery', 'create_imports', 'create_orders', 'manage_webhooks', 'push_products', 'bulk_ops'],
  scale:      ['read_products', 'read_delivery', 'create_imports', 'create_orders', 'manage_webhooks', 'push_products', 'bulk_ops', 'priority'],
  enterprise: ['read_products', 'read_delivery', 'create_imports', 'create_orders', 'manage_webhooks', 'push_products', 'bulk_ops', 'priority'],
};

// ── Rate limits (req/min) ─────────────────────────────────────
const RATE_LIMITS: Record<DeveloperPlan, { perMinute: number; perHour: number }> = {
  free:       { perMinute: 20,  perHour: 200   },
  starter:    { perMinute: 60,  perHour: 1000  },
  growth:     { perMinute: 150, perHour: 5000  },
  scale:      { perMinute: 500, perHour: 20000 },
  enterprise: { perMinute: 500, perHour: 20000 },
};

// ── Max API keys per plan ─────────────────────────────────────
const MAX_KEYS: Record<DeveloperPlan, number | null> = {
  free:       1,
  starter:    3,
  growth:     10,
  scale:      null, // unlimited
  enterprise: null,
};

// ── Plan display names ────────────────────────────────────────
const PLAN_LABELS: Record<DeveloperPlan, string> = {
  free:       'Free',
  starter:    'Starter',
  growth:     'Growth',
  scale:      'Scale',
  enterprise: 'Enterprise',
};

// ── Upgrade path ──────────────────────────────────────────────
// Maps a required permission to the minimum plan needed
const PERMISSION_PLAN_MAP: Record<string, DeveloperPlan> = {
  read_products:  'free',
  read_delivery:  'free',
  create_imports: 'starter',
  create_orders:  'starter',
  manage_webhooks:'starter',
  push_products:  'growth',
  bulk_ops:       'growth',
  priority:       'scale',
};

// ── Public return type ────────────────────────────────────────
export interface UseDeveloperPlanReturn {
  // Current plan
  plan:      DeveloperPlan;
  planLabel: string;
  isTrial:   boolean;

  // Permission helpers
  can: {
    readProducts:    boolean;
    readDelivery:    boolean;
    createImports:   boolean;
    createOrders:    boolean;
    manageWebhooks:  boolean;
    pushProducts:    boolean;
    bulkOps:         boolean;
    priority:        boolean;
  };

  // Raw permission check
  hasPermission: (permission: string) => boolean;

  // Upgrade info — given a permission, what plan does the user need?
  planRequired: (permission: string) => DeveloperPlan;

  // Limits
  limits: {
    maxKeysPerPlan:  number | null;  // null = unlimited
    ratePerMinute:   number;
    ratePerHour:     number;
    // Company accounts get 2x rate limits
    effectiveRatePerMinute: number;
    effectiveRatePerHour:   number;
  };

  // Expiry
  expiry: {
    expiresAt:    string | null;
    daysLeft:     number | null;
    isExpired:    boolean;
    isExpiringSoon: boolean;   // <= 7 days
    isCritical:     boolean;   // <= 2 days
  };
}

// ── Hook ──────────────────────────────────────────────────────
export function useDeveloperPlan(): UseDeveloperPlanReturn {
  const { developer } = useDeveloperAuthStore();

  return useMemo((): UseDeveloperPlanReturn => {
    const plan: DeveloperPlan = developer?.plan ?? 'free';
    const perms               = PERMISSIONS[plan] ?? PERMISSIONS.free;
    const rateLimits          = RATE_LIMITS[plan]  ?? RATE_LIMITS.free;
    const isCompany           = developer?.account_type === 'company';
    const multiplier          = isCompany ? 2 : 1;

    // ── Expiry ──────────────────────────────────────────────────
    const expiresAt = developer?.plan_expires_at ?? null;
    let daysLeft: number | null = null;
    if (expiresAt) {
      daysLeft = Math.ceil(
        (new Date(expiresAt).getTime() - Date.now()) / 86_400_000,
      );
    }

    const hasPermission = (permission: string): boolean =>
      perms.includes(permission);

    return {
      plan,
      planLabel: PLAN_LABELS[plan],
      isTrial:   false, // determined from subscription history — default false

      can: {
        readProducts:   hasPermission('read_products'),
        readDelivery:   hasPermission('read_delivery'),
        createImports:  hasPermission('create_imports'),
        createOrders:   hasPermission('create_orders'),
        manageWebhooks: hasPermission('manage_webhooks'),
        pushProducts:   hasPermission('push_products'),
        bulkOps:        hasPermission('bulk_ops'),
        priority:       hasPermission('priority'),
      },

      hasPermission,

      planRequired: (permission: string): DeveloperPlan =>
        PERMISSION_PLAN_MAP[permission] ?? 'starter',

      limits: {
        maxKeysPerPlan:         MAX_KEYS[plan],
        ratePerMinute:          rateLimits.perMinute,
        ratePerHour:            rateLimits.perHour,
        effectiveRatePerMinute: rateLimits.perMinute * multiplier,
        effectiveRatePerHour:   rateLimits.perHour   * multiplier,
      },

      expiry: {
        expiresAt,
        daysLeft,
        isExpired:      daysLeft !== null && daysLeft < 0,
        isExpiringSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= 7,
        isCritical:     daysLeft !== null && daysLeft >= 0 && daysLeft <= 2,
      },
    };
  }, [developer]);
}

export default useDeveloperPlan;